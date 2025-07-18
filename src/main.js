/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    // Расчет выручки от операции (сумма sale_price * quantity для всех товаров в покупке)
    let revenue = 0;
    for (const item of purchase.items) {
        revenue += item.sale_price * item.quantity;
    }
    return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // Расчет бонуса от позиции в рейтинге
    // Чем выше позиция, тем больше бонус (Senior Seller получает больше)
    const baseBonus = 1000;
    const positionMultiplier = seller.position === "Senior Seller" ? 1.5 : 1;
    const rankMultiplier = 1 - (index / total);
    
    return Math.round(baseBonus * positionMultiplier * rankMultiplier * 10) / 10;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // Проверка входных данных
    if (!data || !data.sellers || !data.products || !data.purchase_records) {
        throw new Error("Invalid data structure");
    }

    // Проверка наличия опций
    if (!options || !options.calculateRevenue || !options.calculateBonus) {
        throw new Error("Calculation functions are required");
    }

    // Подготовка промежуточных данных для сбора статистики
    const sellersStats = {};
    
    // Индексация продавцов и товаров для быстрого доступа
    const sellersMap = {};
    for (const seller of data.sellers) {
        sellersMap[seller.id] = seller;
        sellersStats[seller.id] = {
            seller_id: seller.id,
            name: `${seller.first_name} ${seller.last_name}`,
            revenue: 0,
            profit: 0,
            sales_count: 0,
            products: {}
        };
    }
    
    const productsMap = {};
    for (const product of data.products) {
        productsMap[product.sku] = product;
    }

    // Расчет выручки и прибыли для каждого продавца
    for (const purchase of data.purchase_records) {
        const sellerId = purchase.seller_id;
        const sellerStat = sellersStats[sellerId];
        
        if (!sellerStat) continue;
        
        sellerStat.sales_count += 1;
        
        for (const item of purchase.items) {
            const product = productsMap[item.sku];
            if (!product) continue;
            
            // Расчет выручки
            const itemRevenue = item.sale_price * item.quantity;
            sellerStat.revenue += itemRevenue;
            
            // Расчет прибыли (выручка - закупочная цена * количество)
            const itemProfit = itemRevenue - (product.purchase_price * item.quantity);
            sellerStat.profit += itemProfit;
            
            // Собираем статистику по товарам
            if (!sellerStat.products[item.sku]) {
                sellerStat.products[item.sku] = {
                    count: 0,
                    profit: 0
                };
            }
            sellerStat.products[item.sku].count += item.quantity;
            sellerStat.products[item.sku].profit += itemProfit;
        }
    }

    // Сортировка продавцов по прибыли
    const sortedSellers = Object.values(sellersStats).sort((a, b) => b.profit - a.profit);

    // Назначение премий на основе ранжирования
    const totalSellers = sortedSellers.length;
    sortedSellers.forEach((seller, index) => {
        const sellerInfo = sellersMap[seller.seller_id];
        seller.bonus = options.calculateBonus(index, totalSellers, sellerInfo);
        
        // Определяем топ-3 товара по прибыли для каждого продавца
        const products = Object.entries(seller.products)
            .map(([sku, stats]) => ({
                sku,
                name: productsMap[sku]?.name || "Unknown",
                count: stats.count,
                profit: stats.profit
            }))
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 3);
        
        seller.top_products = products;
    });

    // Подготовка итоговой коллекции с нужными полями
    return sortedSellers.map(seller => ({
        seller_id: seller.seller_id,
        name: seller.name,
        revenue: Math.round(seller.revenue * 100) / 100,
        profit: Math.round(seller.profit * 100) / 100,
        sales_count: seller.sales_count,
        bonus: seller.bonus,
        top_products: seller.top_products
    }));
}