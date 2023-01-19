import { OrderItem, Refund, Shipment } from 'amazon-order-reports-api';

export declare class AmazonOrderReportsCsv {
  constructor(fileLoc: string) {}

  getItems(options?: {
    /** Start of date range to report. */
    startDate: Date;
    /** End of date range to report. */
    endDate: Date;
  }): AsyncGenerator<OrderItem> {}

  /**
   * Retrieve refunds in the given date range. If no date range is given, the previous
   * 30 days will be used.
   */
  getRefunds(options?: {
    /** Start of date range to report. */
    startDate: Date;
    /** End of date range to report. */
    endDate: Date;
  }): AsyncGenerator<Refund> {}

  /**
   * Retrieve shipments in the given date range. If no date range is given, the previous
   * 30 days will be used.
   */
  getShipments(options?: {
    /** Start of date range to report. */
    startDate: Date;
    /** End of date range to report. */
    endDate: Date;
  }): AsyncGenerator<Shipment> {}
}
