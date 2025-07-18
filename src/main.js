/**
 * Функция для расчета прибыли
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const { discount, sale_price, quantity } = purchase;
    const discountFraction = discount / 100;
    const total = sale_price * quantity * (1 - discountFraction);
    return total;
}

/**
   * Функция для расчета бонусов
   * @param index порядковый номер в отсортированном массиве
   * @param total общее число продавцов
   * @param seller карточка продавца
   * @returns {number}
   */
function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;

    if (index === 0) return profit * 0.15;
    if (index === 1 || index === 2) return profit * 0.1;
    if (index === total - 1) return 0;
    return profit * 0.05;
}

/**
   * Функция для анализа данных продаж
   * @param data
   * @param options
   * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
   */
function analyzeSalesData(data, options) {
    if (
    !data ||
    !Array.isArray(data.sellers) ||
    data.sellers.length === 0 ||
    !Array.isArray(data.products) ||
    data.products.length === 0 ||
    !Array.isArray(data.purchase_records) ||
    data.purchase_records.length === 0
    ) {
    throw new Error("Некорректные входные данные");
    }

    if (!options || typeof options !== "object") {
    throw new Error("Некорректные опции");
    }

    const { calculateRevenue, calculateBonus } = options;

    if (!calculateRevenue || !calculateBonus) {
    throw new Error("Отсутствуют необходимые функции в опциях");
    }

    // @TODO: Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
}));

    // @TODO: Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = Object.fromEntries(
    sellerStats.map((seller) => [seller.id, seller])
    );

    const productIndex = Object.fromEntries(
    data.products.map((product) => [product.sku, product])
    );

    // @TODO: Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];

      // Увеличиваем счётчики продавца
    seller.sales_count += 1;
    seller.revenue += record.total_amount;

      // Перебираем все товары в чеке
    record.items.forEach((item) => {
        const product = productIndex[item.sku];

        // Выручка от конкретной продажи
        const revenue = calculateRevenue(item, product);

        // Себестоимость товара
        const cost = product.purchase_price * item.quantity;

        // Прибыль от продажи
        const profit = revenue - cost;

        // Прибавляем прибыль к общей прибыли продавца
        seller.profit += profit;

        // Увеличиваем счётчик проданных товаров
        if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
        }
        seller.products_sold[item.sku] += item.quantity;
});
    });

    // @TODO: Сортировка продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);

    // @TODO: Назначение премий на основе ранжирования
    // @TODO: Назначение премий на основе ранжирования
    sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    seller.top_products = Object.entries(seller.products_sold)
        .map(([sku, quantity]) => ({ sku, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
    });

    // @TODO: Подготовка итоговой коллекции с нужными полями
    return sellerStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name,
      revenue: +seller.revenue.toFixed(2), // число с 2 знаками после точки
      profit: +seller.profit.toFixed(2), // число с 2 знаками после точки
      sales_count: seller.sales_count, // целое число
      top_products: seller.top_products, // массив из топ-10 товаров
      bonus: +seller.bonus.toFixed(2), // число с 2 знаками после точки
    }));
}