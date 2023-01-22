import camelcase from 'camelcase';
import csv from 'csv-parse';
import { createReadStream } from 'fs';
import { mkdir, readdir, rename } from 'fs/promises';
import { DateTime } from 'luxon';
import { createLogger, Logger, LogLevel } from './logger';
import { OrderItem, Refund, Shipment } from 'amazon-order-reports-api';
import { firstline } from './firstline';
import { isAfter, isBefore } from 'date-fns';

const DEFAULT_FILE_LOC = './reports';
const DEFAULT_ARCHIVE_LOC = './reports/archive';

enum ReportType {
  ITEMS = 'ITEMS',
  REFUNDS = 'REFUNDS',
  SHIPMENTS = 'SHIPMENTS',
}

type OrderReportsCsvOptions = ConstructorParameters<typeof OrderReportsCsv>[0];

interface GetReportReturnType {
  [ReportType.ITEMS]: OrderItem;
  [ReportType.REFUNDS]: Refund;
  [ReportType.SHIPMENTS]: Shipment;
}

const reportFirstLineRegex = (t: ReportType): RegExp => {
  switch (t) {
    case ReportType.ITEMS:
      return /.*List Price Per Unit.*/;
    case ReportType.REFUNDS:
      return /.*Refund Date.*/;
    case ReportType.SHIPMENTS:
      /.*Shipping Charge.*/;
  }
  return /.*/;
};

const identity = <T>(x: T): T => x;
// Amazon apparently uses Pacific time for all US users ?
const parseDate = (d: string): Date =>
  DateTime.fromFormat(d, 'MM/dd/yy', { zone: 'America/Los_Angeles' }).toJSDate();
const parsePrice = (p: string) => parseFloat(p.replace(/[^\d.]/g, ''));

export class OrderReportsCsv {
  #logger: Logger;
  #options: OrderReportsCsvOptions;
  #fileLoc: string;
  #archiveLoc: string;

  constructor(options: {
    /**
     * Directory to look for reports
     * @default "./reports"
     */
    fileLoc?: string;

    /**
     * Directory to move reports after use
     * @default "./reports/archive"
     */
    archiveLoc?: string;

    /**
     * Emit log messages at this level. Currently only {@link LogLevel.DEBUG} is used.
     * @default {@link LogLevel.NONE}
     */
    logLevel?: LogLevel;
  }) {
    this.#logger = createLogger(options.logLevel ?? LogLevel.NONE);
    this.#options = options;
    this.#fileLoc = this.#options.fileLoc || DEFAULT_FILE_LOC;
    this.#archiveLoc = this.#options.archiveLoc || DEFAULT_ARCHIVE_LOC;
  }

  /**
   * Retrieve ordered items in the given date range. If no date range is given, the previous
   * 30 days will be used.
   */
  async *getItems(
    options: {
      /** Start of date range to report. */
      startDate: Date;
      /** End of date range to report. */
      endDate: Date;
    } = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    },
  ): AsyncGenerator<OrderItem> {
    yield* this._getReport(ReportType.ITEMS, options, OrderReportsCsv._parseOrderItemRecord);
  }

  /**
   * Retrieve refunds in the given date range. If no date range is given, the previous
   * 30 days will be used.
   */
  async *getRefunds(
    options: {
      /** Start of date range to report. */
      startDate: Date;
      /** End of date range to report. */
      endDate: Date;
    } = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    },
  ): AsyncGenerator<Refund> {
    yield* this._getReport(ReportType.REFUNDS, options, OrderReportsCsv._parseRefundRecord);
  }

  /**
   * Retrieve shipments in the given date range. If no date range is given, the previous
   * 30 days will be used.
   */
  async *getShipments(
    options: {
      /** Start of date range to report. */
      startDate: Date;
      /** End of date range to report. */
      endDate: Date;
    } = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    },
  ): AsyncGenerator<Shipment> {
    yield* this._getReport(ReportType.SHIPMENTS, options, OrderReportsCsv._parseShipmentRecord);
  }

  private static _parseOrderItemRecord(record: { [key: string]: string }): OrderItem {
    return (Object.fromEntries(
      Object.entries(record)
        .filter(([, value]) => value !== '')
        .map(([key, value]) => {
          const transformFn =
            ({
              itemSubtotal: parsePrice,
              itemSubtotalTax: parsePrice,
              itemTotal: parsePrice,
              listPricePerUnit: parsePrice,
              orderDate: parseDate,
              purchasePricePerUnit: parsePrice,
              quantity: parseInt,
              releaseDate: parseDate,
              shipmentDate: parseDate,
            } as { [columnValue: string]: (value: unknown) => unknown })[key] ?? identity;

          return [key, transformFn(value)];
        }),
    ) as unknown) as OrderItem;
  }

  private static _parseRefundRecord(record: { [key: string]: string }): Refund {
    return (Object.fromEntries(
      Object.entries(record)
        .filter(([, value]) => value !== '')
        .map(([key, value]) => {
          const transformFn =
            ({
              orderDate: parseDate,
              quantity: parseInt,
              refundAmount: parsePrice,
              refundDate: parseDate,
              refundTaxAmount: parsePrice,
            } as { [columnValue: string]: (value: unknown) => unknown })[key] ?? identity;

          return [key, transformFn(value)];
        }),
    ) as unknown) as Refund;
  }

  private static _parseShipmentRecord(record: { [key: string]: string }): Shipment {
    return (Object.fromEntries(
      Object.entries(record)
        .filter(([, value]) => value !== '')
        .map(([key, value]) => {
          const transformFn =
            ({
              orderDate: parseDate,
              shipmentDate: parseDate,
              subtotal: parsePrice,
              shippingCharge: parsePrice,
              taxBeforePromotions: parsePrice,
              totalPromotions: parsePrice,
              taxCharged: parsePrice,
              totalCharged: parsePrice,
            } as { [columnValue: string]: (value: unknown) => unknown })[key] ?? identity;

          return [key, transformFn(value)];
        }),
    ) as unknown) as Shipment;
  }

  private async _archiveReport(reportFileName: string): Promise<void> {
    await mkdir(`${this.#archiveLoc}`);
    await rename(`${this.#fileLoc}/${reportFileName}`, `${this.#archiveLoc}/${reportFileName}`);
  }

  private async _findReport(reportType: ReportType): Promise<[string, string]> {
    const files = await readdir(this.#fileLoc);
    for (const file of files) {
      this.#logger.info(`Checking for type of file ${file}`);
      const fileFirstLine = await firstline(`${this.#fileLoc}/${file}`);
      if (reportFirstLineRegex(reportType).test(fileFirstLine)) {
        return [file, `${this.#fileLoc}/${file}`];
      }
    }
    return ['', ''];
  }

  private async *_getReport<T extends ReportType>(
    reportType: T,
    options: {
      startDate: Date;
      endDate: Date;
    } = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    },
    parseFn: (record: { [key: string]: string }) => GetReportReturnType[T],
  ): AsyncGenerator<GetReportReturnType[T]> {
    const { startDate, endDate } = options;

    const [reportName, reportPath] = await this._findReport(reportType);

    try {
      const csvStream = createReadStream(reportPath).pipe(
        csv({
          columns: (headers: Array<string>) =>
            headers.map((header) => camelcase(header.replace(/\W/g, ' '))),
        }),
      );

      for await (const record of csvStream) {
        const recordObj = parseFn(record);
        if (isAfter(recordObj.orderDate, startDate) && isBefore(recordObj.orderDate, endDate)) {
          yield recordObj;
        }
      }
    } finally {
      try {
        await this._archiveReport(reportName);
      } catch {}
    }
  }
}

export { LogLevel } from './logger';
