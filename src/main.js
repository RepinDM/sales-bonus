/**
 * Функция для анализа данных продаж
 * @param {Object} data - входные данные
 * @param {Object} options - опции расчета
 * @returns {Array} - массив с результатами анализа
 */
function analyzeSalesData(data, options) {
    // Валидация входных данных
    if (!data || typeof data !== 'object') throw new Error("Data must be an object");
    if (!Array.isArray(data.sellers) || data.sellers.length === 0) throw new Error("Список продавцов пуст");
    if (!Array.isArray(data.products) || data.products.length === 0) throw new Error("Список товаров пуст");
    if (!Array.isArray(data.purchase_records) || data.purchase_records.length === 0) throw new Error("Список покупок пуст");
    if (!options || typeof options !== 'object') throw new Error("Options must be an object");
    if (typeof options.calculateRevenue !== 'function') throw new Error("calculateRevenue function is required");
    if (typeof options.calculateBonus !== 'function') throw new Error("calculateBonus function is required");

    // Создаем структуры для быстрого доступа
    const sellersMap = {};
    const productsMap = {};

    data.sellers.forEach(seller => {
        if (!seller?.id || !seller?.first_name || !seller?.last_name) {
            throw new Error("Invalid seller structure");
        }
        sellersMap[seller.id] = seller;
    });

    data.products.forEach(product => {
        if (!product?.sku || !product?.name || typeof product?.purchase_price !== 'number') {
            throw new Error("Invalid product structure");
        }
        productsMap[product.sku] = product;
    });

    // Собираем статистику по продавцам
    const sellersStats = {};

    data.purchase_records.forEach(purchase => {
        if (!purchase?.seller_id || !purchase?.items || !Array.isArray(purchase.items)) {
            throw new Error("Invalid purchase structure");
        }

        const sellerId = purchase.seller_id;
        if (!sellersMap[sellerId]) return;

        if (!sellersStats[sellerId]) {
            sellersStats[sellerId] = {
                seller_id: sellerId,
                name: `${sellersMap[sellerId].first_name} ${sellersMap[sellerId].last_name}`,
                revenue: 0,
                profit: 0,
                sales_count: 0,
                products: {}
            };
        }

        const sellerStat = sellersStats[sellerId];
        sellerStat.sales_count += 1;

        purchase.items.forEach(item => {
            if (!item?.sku || typeof item?.sale_price !== 'number' || typeof item?.quantity !== 'number') {
                throw new Error("Invalid item structure");
            }

            const product = productsMap[item.sku];
            if (!product) return;

            const itemRevenue = item.sale_price * item.quantity;
            const itemCost = product.purchase_price * item.quantity;
            const itemProfit = itemRevenue - itemCost;

            sellerStat.revenue += itemRevenue;
            sellerStat.profit += itemProfit;

            if (!sellerStat.products[item.sku]) {
                sellerStat.products[item.sku] = {
                    sku: item.sku,
                    quantity: 0
                };
            }
            sellerStat.products[item.sku].quantity += item.quantity;
        });
    });

    // Сортируем продавцов по profit (по убыванию)
    const sortedSellers = Object.values(sellersStats).sort((a, b) => b.profit - a.profit);

    // Добавляем бонусы и топ товары
    return sortedSellers.map((seller, index) => {
        const sellerInfo = {
            ...sellersMap[seller.seller_id],
            profit: seller.profit
        };

        // Формируем топ товаров (сортировка по quantity и берем больше товаров)
        const topProducts = Object.entries(seller.products)
            .map(([sku, product]) => ({
                sku,
                quantity: product.quantity
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10); // Берем до 10 товаров как в тесте

        return {
            seller_id: seller.seller_id,
            name: seller.name,
            revenue: parseFloat(seller.revenue.toFixed(2)),
            profit: parseFloat(seller.profit.toFixed(2)),
            sales_count: seller.sales_count,
            bonus: options.calculateBonus(index, sortedSellers.length, sellerInfo),
            top_products: topProducts
        };
    });
}