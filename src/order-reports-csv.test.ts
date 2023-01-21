import OrderReportsCSV from './order-reports-csv';

it('Should list files', async () => {
  const orderReports = new OrderReportsCSV('reports/');

  const result = await orderReports.initFiles();
  expect(result).toBe(true);
});
