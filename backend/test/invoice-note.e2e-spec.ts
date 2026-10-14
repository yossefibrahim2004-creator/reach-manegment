import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { INVOICE_NOTE_MAX_LENGTH } from '../src/common/constants/invoice.constants';

jest.setTimeout(30000);

describe('Invoice note (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: Record<string, string> = {};
  let category: { id: number };
  let model: { id: number };
  let customer: { id: number };

  const createInvoice = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    // Mirror main.ts so DTO validation (whitelist/forbidNonWhitelisted) runs in tests.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    const login = async (username: string, password: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username, password })
        .expect(201);
      return res.body.accessToken;
    };

    tokens.admin = await login('testadmin', 'admin123');
    tokens.accountant = await login('testaccountant', 'accountant123');
    tokens.sales = await login('testsales', 'sales123');

    category = await prisma.category.create({
      data: { name: `Note Cat ${Date.now()}-${Math.random()}`, isActive: true },
    });
    model = await prisma.productModel.create({
      data: {
        categoryId: category.id,
        name: 'Note Test Model',
        isSerialized: false,
        minStockAlert: 0,
        isActive: true,
      },
    });
    customer = await prisma.customer.create({
      data: { name: 'Note Test Customer', type: 'INDIVIDUAL', isActive: true },
    });

    const supplier = await prisma.supplier.create({
      data: { name: `Note Supplier ${Date.now()}`, isActive: true },
    });
    const receipt = await prisma.stockReceipt.create({
      data: {
        employeeId: 1,
        supplierId: supplier.id,
        status: 'PRICED',
        pricedByEmployeeId: 1,
        pricedAt: new Date(),
        date: new Date(),
      },
    });
    await prisma.stockLot.create({
      data: {
        productModelId: model.id,
        stockReceiptId: receipt.id,
        supplierId: supplier.id,
        quantityReceived: 500,
        quantityRemaining: 500,
        quantityReserved: 0,
        purchasePrice: 50,
        receivedDate: new Date(),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const baseItem = () => [{ productModelId: model.id, quantity: 1, price: 100 }];

  it('persists a short Arabic note and returns it on GET', async () => {
    const res = await createInvoice(tokens.sales, {
      customerId: customer.id,
      paymentType: 'CASH',
      note: 'ملاحظة اختبار',
      items: baseItem(),
    }).expect(201);

    const fetched = await request(app.getHttpServer())
      .get(`/api/invoices/${res.body.id}`)
      .set('Authorization', `Bearer ${tokens.sales}`)
      .expect(200);
    expect(fetched.body.note).toBe('ملاحظة اختبار');
  });

  it('stores a whitespace-only note as null', async () => {
    const res = await createInvoice(tokens.sales, {
      customerId: customer.id,
      paymentType: 'CASH',
      note: '   \n  ',
      items: baseItem(),
    }).expect(201);

    const row = await prisma.invoice.findUnique({ where: { id: res.body.id } });
    expect(row?.note).toBeNull();
  });

  it('stores an omitted note as null (backward compatible)', async () => {
    const res = await createInvoice(tokens.sales, {
      customerId: customer.id,
      paymentType: 'CASH',
      items: baseItem(),
    }).expect(201);

    const row = await prisma.invoice.findUnique({ where: { id: res.body.id } });
    expect(row?.note).toBeNull();
  });

  it('preserves multi-line and mixed-direction notes verbatim', async () => {
    const note = 'سطر أول\nسطر ثانٍ with English and 123';
    const res = await createInvoice(tokens.sales, {
      customerId: customer.id,
      paymentType: 'CASH',
      note,
      items: baseItem(),
    }).expect(201);

    const fetched = await request(app.getHttpServer())
      .get(`/api/invoices/${res.body.id}`)
      .set('Authorization', `Bearer ${tokens.sales}`)
      .expect(200);
    expect(fetched.body.note).toBe(note);
  });

  it('accepts a note of exactly the max length', async () => {
    const note = 'م'.repeat(INVOICE_NOTE_MAX_LENGTH);
    const res = await createInvoice(tokens.sales, {
      customerId: customer.id,
      paymentType: 'CASH',
      note,
      items: baseItem(),
    }).expect(201);

    const row = await prisma.invoice.findUnique({ where: { id: res.body.id } });
    expect(row?.note).toHaveLength(INVOICE_NOTE_MAX_LENGTH);
  });

  it(`rejects a note longer than ${INVOICE_NOTE_MAX_LENGTH} characters with 400`, async () => {
    const note = 'م'.repeat(INVOICE_NOTE_MAX_LENGTH + 1);
    const res = await createInvoice(tokens.sales, {
      customerId: customer.id,
      paymentType: 'CASH',
      note,
      items: baseItem(),
    }).expect(400);

    const messages = Array.isArray(res.body.message) ? res.body.message : [res.body.message];
    expect(
      messages.some((m: string) =>
        typeof m === 'string' && m.includes(`equal to ${INVOICE_NOTE_MAX_LENGTH} characters`),
      ),
    ).toBe(true);
  });

  it('accepts an explicit null note (IsOptional)', async () => {
    const res = await createInvoice(tokens.sales, {
      customerId: customer.id,
      paymentType: 'CASH',
      note: null,
      items: baseItem(),
    }).expect(201);

    const row = await prisma.invoice.findUnique({ where: { id: res.body.id } });
    expect(row?.note).toBeNull();
  });

  it('still rejects unknown properties (whitelist not weakened)', async () => {
    const res = await createInvoice(tokens.sales, {
      customerId: customer.id,
      paymentType: 'CASH',
      noteExtra: 'x',
      items: baseItem(),
    }).expect(400);

    const messages = Array.isArray(res.body.message) ? res.body.message : [res.body.message];
    expect(messages.some((m: string) => typeof m === 'string' && m.includes('noteExtra'))).toBe(true);
  });

  it('keeps the note through accountant confirmation', async () => {
    const created = await createInvoice(tokens.sales, {
      customerId: customer.id,
      paymentType: 'CASH',
      note: 'تبقى بعد التأكيد',
      items: baseItem(),
    }).expect(201);

    await request(app.getHttpServer())
      .patch(`/api/invoices/${created.body.id}/confirm`)
      .set('Authorization', `Bearer ${tokens.accountant}`)
      .expect(200);

    const fetched = await request(app.getHttpServer())
      .get(`/api/invoices/${created.body.id}`)
      .set('Authorization', `Bearer ${tokens.sales}`)
      .expect(200);
    expect(fetched.body.status).toBe('CONFIRMED');
    expect(fetched.body.note).toBe('تبقى بعد التأكيد');
  });

  it('keeps the note through an approved price-change request', async () => {
    const created = await createInvoice(tokens.sales, {
      customerId: customer.id,
      paymentType: 'CASH',
      note: 'تبقى بعد التعديل',
      items: baseItem(),
    }).expect(201);

    await request(app.getHttpServer())
      .patch(`/api/invoices/${created.body.id}/confirm`)
      .set('Authorization', `Bearer ${tokens.accountant}`)
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/invoices/${created.body.id}`)
      .set('Authorization', `Bearer ${tokens.sales}`)
      .expect(200);
    const invoiceItemId = detail.body.items[0].id;

    const cr = await request(app.getHttpServer())
      .post(`/api/invoices/${created.body.id}/change-requests`)
      .set('Authorization', `Bearer ${tokens.sales}`)
      .send({
        type: 'EDIT',
        reason: 'تغيير سعر',
        items: [{ action: 'CHANGE_PRICE', invoiceItemId, proposedPrice: 120 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/change-requests/${cr.body.id}/approve`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({})
      .expect(200);

    const fetched = await request(app.getHttpServer())
      .get(`/api/invoices/${created.body.id}`)
      .set('Authorization', `Bearer ${tokens.sales}`)
      .expect(200);
    expect(fetched.body.note).toBe('تبقى بعد التعديل');
  });
});
