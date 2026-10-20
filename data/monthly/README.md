# ملفات الشهر للداشبورد

مجلد لكل شهر `data/monthly/YYYY-MM/` بأسماء ثابتة. قبل البناء:

    cd executive_dashboard && python3 -m src.monthly 2026-10

يسمّى كل ملف ناقص بالاسم، و `python3 build_all.py --month 2026-10 --strict` يتوقف قبل البناء إن نقص ملف مطلوب
(كل بناء يطبع قائمة آخر شهر على أى حال).

| الملف | مطلوب | المحتوى | من |
|---|---|---|---|
| sales_invoices.pdf | ✔ | فواتير المبيعات للشهر ببنودها (من 1 إلى آخر الشهر) | الإدارة |
| collections.pdf | ✔ | تحصيلات العملاء للشهر | الإدارة |
| returns_items.pdf | ✔ | مرتجعات العملاء للشهر بالأصناف | الإدارة |
| customer_balances_by_rep.pdf | ✔ | أرصدة العملاء حسب المندوب فى آخر يوم من الشهر | الإدارة |
| supplier_balances.pdf | ✔ | أرصدة الموردين | الإدارة |
| purchases.pdf | ✔ | تقرير المشتريات التفصيلى للشهر | الإدارة |
| inventory_valuation.xlsx | ✔ | الجرد مُسعّرًا: `monthly/YYYY-MM/stock_count_priced.xlsx` من مستودع Abohashem (`python3 model/wac.py YYYY-MM`) | Abohashem |
| wac.json | | متوسط الخامات وسعر كجم الوصفات: `monthly/YYYY-MM/wac.json` من Abohashem | Abohashem |
| wac_model.xlsx | | مصنّف الاحتساب التفصيلى إن صدر | Abohashem |
| stock_count.xlsx | | الجرد الفعلى قبل التسعير | الإدارة |
| income_statement.pdf | | قائمة الدخل التفصيلية للشهر | المحاسب |

الأشهر الموجودة قبل هذا الترتيب (يونيو–سبتمبر 2026) ملفاتها باقية فى `data/raw/ops` بأسمائها
(`purchases_2026-09.pdf`، `inventory_valuation_2026-09.xlsx`، …) والقائمة تقبلها هناك.
