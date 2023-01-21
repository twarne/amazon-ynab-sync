import { OrderItem, Refund, Shipment } from 'amazon-order-reports-api';
import { parse } from 'csv/.';
import { createReadStream } from 'fs';
import { readdir } from 'fs/promises';

export default class OrderReportsCsv {
  fileLoc: string;
  items: OrderItem[];
  shipments: Shipment[];
  refunds: Refund[];

  constructor(fileLoc: string) {
    this.fileLoc = fileLoc;
    this.items = [];
    this.shipments = [];
    this.refunds = [];
  }

  async initFiles(): Promise<boolean> {
    try {
      const files = await readdir(this.fileLoc);
      for (const file of files) {
        console.log(file);
        const parser = createReadStream(`${this.fileLoc}/${file}`).pipe(parse({}));
        for await (const record of parser) {
        }
      }
    } catch (err) {
      console.error(err);
    }

    return true;
  }

  /**   getItems(options?: {
    /** Start of date range to report. *
    startDate: Date;
    /** End of date range to report. *
    endDate: Date;
  }): AsyncGenerator<OrderItem> {

    return ;
    
  }

  /**
   * Retrieve refunds in the given date range. If no date range is given, the previous
   * 30 days will be used.
   *
  getRefunds(options?: {
    /** Start of date range to report. *
    startDate: Date;
    /** End of date range to report. *
    endDate: Date;
  }): AsyncGenerator<Refund> {}

  /**
   * Retrieve shipments in the given date range. If no date range is given, the previous
   * 30 days will be used.
   *
  getShipments(options?: {
    /** Start of date range to report. *
    startDate: Date;
    /** End of date range to report. *
    endDate: Date;
  }): AsyncGenerator<Shipment> {}*/
}
