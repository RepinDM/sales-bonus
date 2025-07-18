/**
 * Функция для расчета выручки от продажи
 * @param {Object} purchase - запись о покупке
 * @returns {number} - сумма выручки
 */
function calculateSimpleRevenue(purchase) {
    if (!purchase || !purchase.items || !Array.isArray(purchase.items)) {
        throw new Error("Invalid purchase data structure");
    }

    return purchase.items.reduce((sum, item) => {
        if (typeof item.sale_price !== 'number' || typeof item.quantity !== 'number') {
            throw new Error("Invalid item data structure");
        }
        return sum + item.sale_price * item.quantity;
    }, 0);
}

/**
 * Функция для расчета бонусов продавцам
 * @param {number} index - порядковый номер в отсортированном массиве
 * @param {number} total - общее число продавцов
 * @param {Object} seller - карточка продавца
 * @returns {number} - сумма бонуса
 */
function calculateBonusByProfit(index, total, seller) {
    if (typeof index !== 'number' || typeof total !== 'number' || !seller) {
        throw new Error("Invalid input parameters");
    }
    if (index < 0 || index >= total) {
        throw new Error("Index out of range");
    }
    if (typeof seller.profit !== 'number') {
        throw new Error("Seller profit must be a number");
    }

    let bonusRate;
    if (index === 0) bonusRate = 0.15;
    else if (index <= 2) bonusRate = 0.10;
    else if (index === total - 2) bonusRate = 0.05;
    else bonusRate = 0;

    const positionMultiplier = seller.position === "Senior Seller" ? 1.5 : 1;
    return parseFloat((seller.profit * bonusRate * positionMultiplier).toFixed(2));
}

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
    const sellersMap = data.sellers.reduce((acc, seller) => {
        if (!seller.id || !seller.first_name || !seller.last_name) throw new Error("Invalid seller structure");
        acc[seller.id] = seller;
        return acc;
    }, {});

    const productsMap = data.products.reduce((acc, product) => {
        if (!product.sku || !product.name || typeof product.purchase_price !== 'number') {
            throw new Error("Invalid product structure");
        }
        acc[product.sku] = product;
        return acc;
    }, {});

    // Собираем статистику по продавцам
    const sellersStats = data.purchase_records.reduce((acc, purchase) => {
        if (!purchase.seller_id || !purchase.items || !Array.isArray(purchase.items)) {
            throw new Error("Invalid purchase structure");
        }

        const sellerId = purchase.seller_id;
        if (!acc[sellerId]) {
            const seller = sellersMap[sellerId];
            if (!seller) return acc;
            
            acc[sellerId] = {
                seller_id: sellerId,
                name: `${seller.first_name} ${seller.last_name}`,
                revenue: 0,
                profit: 0,
                sales_count: 0,
                products: {}
            };
        }

        const sellerStat = acc[sellerId];
        sellerStat.sales_count += 1;

        purchase.items.forEach(item => {
            if (!item.sku || typeof item.sale_price !== 'number' || typeof item.quantity !== 'number') {
                throw new Error("Invalid item structure");
            }

            const product = productsMap[item.sku];
            if (!product) return;

            const itemRevenue = item.sale_price * item.quantity;
            const itemProfit = itemRevenue - product.purchase_price * item.quantity;

            sellerStat.revenue += itemRevenue;
            sellerStat.profit += itemProfit;

            if (!sellerStat.products[item.sku]) {
                sellerStat.products[item.sku] = {
                    count: 0,
                    profit: 0,
                    name: product.name
                };
            }
            sellerStat.products[item.sku].count += item.quantity;
            sellerStat.products[item.sku].profit += itemProfit;
        });

        return acc;
    }, {});

    // Сортируем продавцов по profit (по убыванию)
    const sortedSellers = Object.values(sellersStats).sort((a, b) => b.profit - a.profit);

    // Добавляем бонусы и топ товары
    return sortedSellers.map((seller, index) => {
        const sellerInfo = sellersMap[seller.seller_id];
        sellerInfo.profit = seller.profit; // Добавляем profit для расчета бонуса

        const topProducts = Object.values(seller.products)
            .sort((a, b) => b.profit - a.profit || b.count - a.count)
            .slice(0, 3)
            .map(product => ({
                sku: product.sku,
                name: product.name,
                count: product.count,
                profit: parseFloat(product.profit.toFixed(2))
            }));

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