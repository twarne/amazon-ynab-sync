import { OrderItem, Refund, Shipment } from 'amazon-order-reports-api';
import appRootPath from 'app-root-path';
import { createReadStream, Dirent, FSWatcher, PathLike, ReadStream, watch } from 'fs';
import { mkdtemp, readdir, rename } from 'fs/promises';
import mockdate from 'mockdate';
import { tmpdir } from 'os';
import { Readable } from 'stream';
import { mocked } from 'ts-jest/utils';
import { v4 as uuidv4 } from 'uuid';
import { firstline } from './firstline';
import { OrderReportsCsv } from './order-reports-local';

jest.mock('delay');
jest.mock('fs');
jest.mock('fs/promises');
jest.mock('os');
jest.mock('uuid');
jest.mock('./firstline');

describe('OrderReportsCsv', () => {
  beforeEach(() => {
    mocked(createReadStream).mockReturnValue((Readable.from([]) as unknown) as ReadStream);
    mocked(mkdtemp).mockResolvedValue('/tmp/amzscrKudNUt');
    mocked(readdir).mockResolvedValue([('01-Dec-2020_to_31-Dec-2020.csv' as unknown) as Dirent]);
    mocked(tmpdir).mockReturnValue('/tmp/');
    mocked(uuidv4).mockReturnValue('5fb041e4-ad7a-41d4-879f-d1ec1919201a');
    mocked(watch).mockImplementation((_filename: PathLike, fn) => {
      (fn as (event: string, filename: string) => void)('rename', '01-Dec-2020_to_31-Dec-2020.csv');
      return ({ close: jest.fn() } as unknown) as FSWatcher;
    });
    mocked(firstline).mockReturnValue(Promise.resolve(''));

    mockdate.set('2020-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    jest.resetAllMocks();
    mockdate.reset();
  });

  describe('getItems', () => {
    let api: OrderReportsCsv;

    beforeEach(() => {
      api = new OrderReportsCsv({});

      mocked(createReadStream).mockImplementation(() =>
        jest.requireActual('fs').createReadStream(appRootPath.resolve('test-data/items.csv')),
      );
      (firstline as jest.Mock).mockReturnValue(
        Promise.resolve(
          'Order Date,Order ID,Title,Category,ASIN/ISBN,UNSPSC Code,Website,Release Date,Condition,Seller,Seller Credentials,List Price Per Unit,Purchase Price Per Unit,Quantity,Payment Instrument Type,Purchase Order Number,PO Line Number,Ordering Customer Email,Shipment Date,Shipping Address Name,Shipping Address Street 1,Shipping Address Street 2,Shipping Address City,Shipping Address State,Shipping Address Zip,Order Status,Carrier Name & Tracking Number,Item Subtotal,Item Subtotal Tax,Item Total,Tax Exemption Applied,Tax Exemption Type,Exemption Opt-Out,Buyer Name,Currency,Group Name',
        ),
      );
    });

    it('should return item for each row in report', async () => {
      const items: Array<OrderItem> = [];
      for await (const item of api.getItems()) {
        items.push(item);
      }

      expect(items).toHaveLength(3);
      expect(items).toMatchSnapshot();
    });

    it('should delete report on disk', async () => {
      for await (const _ of api.getItems()) {
      }

      expect(rename).toBeCalledWith(
        './reports/01-Dec-2020_to_31-Dec-2020.csv',
        './reports/archive/01-Dec-2020_to_31-Dec-2020.csv',
      );
    });

    it('should handle reports with no data', async () => {
      mocked(createReadStream).mockImplementationOnce(() =>
        jest
          .requireActual('fs')
          .createReadStream(appRootPath.resolve('test-data/items-no-data.csv')),
      );

      const items: Array<OrderItem> = [];
      for await (const item of api.getItems()) {
        items.push(item);
      }

      expect(items).toHaveLength(0);
    });
  });

  describe('getRefunds', () => {
    let api: OrderReportsCsv;

    beforeEach(() => {
      api = new OrderReportsCsv({});

      mocked(createReadStream).mockImplementation(() =>
        jest.requireActual('fs').createReadStream(appRootPath.resolve('test-data/refunds.csv')),
      );
    });

    it('should return refund for each row in report', async () => {
      const items: Array<Refund> = [];
      for await (const item of api.getRefunds()) {
        items.push(item);
      }

      expect(items).toHaveLength(3);
      expect(items).toMatchSnapshot();
    });
  });

  describe('getShipments', () => {
    let api: OrderReportsCsv;

    beforeEach(() => {
      api = new OrderReportsCsv({});

      mocked(createReadStream).mockImplementation(() =>
        jest.requireActual('fs').createReadStream(appRootPath.resolve('test-data/shipments.csv')),
      );
    });

    it('should return shipment for each row in report', async () => {
      const shipments: Array<Shipment> = [];
      for await (const shipment of api.getShipments()) {
        shipments.push(shipment);
      }

      expect(shipments).toHaveLength(3);
      expect(shipments).toMatchSnapshot();
    });
  });
});
