/**
 * Функция для расчета выручки от продажи
 * @param {Object} purchase - запись о покупке
 * @returns {number} - сумма выручки
 */
function calculateSimpleRevenue(purchase) {
    // Проверка входных данных
    if (!purchase || !purchase.items || !Array.isArray(purchase.items)) {
        throw new Error("Invalid purchase data structure");
    }

    let revenue = 0;
    for (const item of purchase.items) {
        // Проверка наличия обязательных полей
        if (typeof item.sale_price !== 'number' || typeof item.quantity !== 'number') {
            throw new Error("Invalid item data structure");
        }
        revenue += item.sale_price * item.quantity;
    }
    return Number(revenue.toFixed(2));
}

/**
 * Функция для расчета бонусов продавцам
 * @param {number} index - порядковый номер в отсортированном массиве
 * @param {number} total - общее число продавцов
 * @param {Object} seller - карточка продавца
 * @returns {number} - сумма бонуса
 */
function calculateBonusByProfit(index, total, seller) {
    // Валидация входных параметров
    if (typeof index !== 'number' || typeof total !== 'number' || !seller) {
        throw new Error("Invalid input parameters");
    }
    if (index < 0 || index >= total) {
        throw new Error("Index out of range");
    }
    if (typeof seller.profit !== 'number') {
        throw new Error("Seller profit must be a number");
    }

    // Определяем процент бонуса в зависимости от позиции
    let bonusRate;
    
    if (index === 0) {
        bonusRate = 0.15; // 15% для первого места
    } else if (index <= 2) {
        bonusRate = 0.10; // 10% для второго и третьего места
    } else if (index === total - 2) {
        bonusRate = 0.05; // 5% для предпоследнего
    } else {
        bonusRate = 0; // 0% для последнего и других
    }
    
    // Учитываем Senior Seller (дополнительный множитель 1.5)
    const positionMultiplier = seller.position === "Senior Seller" ? 1.5 : 1;
    
    // Рассчитываем бонус от прибыли
    return Number((seller.profit * bonusRate * positionMultiplier).toFixed(2));
}

/**
 * Функция для анализа данных продаж
 * @param {Object} data - входные данные
 * @param {Object} options - опции расчета
 * @returns {Array} - массив с результатами анализа
 */
function analyzeSalesData(data, options) {
    // Проверка входных данных
    if (!data || typeof data !== 'object') {
        throw new Error("Data must be an object");
    }
    
    if (!data.sellers || !data.products || !data.purchase_records) {
        throw new Error("Invalid data structure");
    }

    // Проверка на пустые массивы
    if (!Array.isArray(data.sellers) || data.sellers.length === 0) {
        throw new Error("Список продавцов пуст");
    }
    if (!Array.isArray(data.products) || data.products.length === 0) {
        throw new Error("Список товаров пуст");
    }
    if (!Array.isArray(data.purchase_records) || data.purchase_records.length === 0) {
        throw new Error("Список покупок пуст");
    }

    // Проверка наличия опций
    if (!options || typeof options !== 'object') {
        throw new Error("Options must be an object");
    }
    if (typeof options.calculateRevenue !== 'function') {
        throw new Error("calculateRevenue function is required");
    }
    if (typeof options.calculateBonus !== 'function') {
        throw new Error("calculateBonus function is required");
    }

    // Подготовка промежуточных данных
    const sellersStats = {};
    const sellersMap = {};
    const productsMap = {};

    // Заполняем карту продавцов
    for (const seller of data.sellers) {
        if (!seller.id || !seller.first_name || !seller.last_name) {
            throw new Error("Invalid seller structure");
        }
        
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
    
    // Заполняем карту товаров
    for (const product of data.products) {
        if (!product.sku || !product.name || typeof product.purchase_price !== 'number') {
            throw new Error("Invalid product structure");
        }
        
        productsMap[product.sku] = product;
    }

    // Обрабатываем записи о покупках
    for (const purchase of data.purchase_records) {
        if (!purchase.seller_id || !purchase.items || !Array.isArray(purchase.items)) {
            throw new Error("Invalid purchase structure");
        }
        
        const sellerId = purchase.seller_id;
        const sellerStat = sellersStats[sellerId];
        
        if (!sellerStat) continue;
        
        sellerStat.sales_count += 1;
        
        for (const item of purchase.items) {
            if (!item.sku || typeof item.sale_price !== 'number' || typeof item.quantity !== 'number') {
                throw new Error("Invalid item structure");
            }
            
            const product = productsMap[item.sku];
            if (!product) continue;
            
            // Расчет выручки и прибыли
            const itemRevenue = item.sale_price * item.quantity;
            const itemProfit = itemRevenue - (product.purchase_price * item.quantity);
            
            sellerStat.revenue += itemRevenue;
            sellerStat.profit += itemProfit;
            
            // Обновляем статистику по товарам
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

    // Сортируем продавцов по прибыли
    const sortedSellers = Object.values(sellersStats).sort((a, b) => b.profit - a.profit);

    // Рассчитываем бонусы
    const totalSellers = sortedSellers.length;
    sortedSellers.forEach((seller, index) => {
        const sellerInfo = sellersMap[seller.seller_id];
        sellerInfo.profit = seller.profit; // Добавляем profit для расчета бонуса
        
        seller.bonus = options.calculateBonus(index, totalSellers, sellerInfo);
        
        // Формируем топ-3 товаров
        seller.top_products = Object.entries(seller.products)
            .map(([sku, stats]) => ({
                sku,
                name: productsMap[sku]?.name || "Unknown",
                count: stats.count,
                profit: Number(stats.profit.toFixed(2))
            }))
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 3);
    });

    // Подготавливаем итоговый результат
    return sortedSellers.map(seller => ({
        seller_id: seller.seller_id,
        name: seller.name,
        revenue: Number(seller.revenue.toFixed(2)),
        profit: Number(seller.profit.toFixed(2)),
        sales_count: seller.sales_count,
        bonus: seller.bonus,
        top_products: seller.top_products
    }));
}