const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { products, regions } = require("./data");


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


function askQuestion(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}


function getProductPrice(product, region) {
  return product.prices[region];
}


function findCheapestInCategory(category, region, excludeProductId = null) {
  const productsInCategory = products.filter(p => p.category === category);
  let cheapest = null;
  let minPrice = Infinity;

  for (const product of productsInCategory) {
    if (excludeProductId !== null && product.id === excludeProductId) continue;
    const price = getProductPrice(product, region);
    if (price < minPrice) {
      minPrice = price;
      cheapest = product;
    }
  }
  return { product: cheapest, price: minPrice };
}


function applyRetentionLogic(selectedProduct, selectedRegion) {
  const currentPrice = getProductPrice(selectedProduct, selectedRegion);
  const category = selectedProduct.category;


  const { product: cheapestProduct, price: cheapestPrice } = findCheapestInCategory(category, selectedRegion, selectedProduct.id);


  if (cheapestProduct && cheapestPrice < currentPrice) {
    return {
      type: "alternative",
      suggestedProduct: cheapestProduct,
      suggestedPrice: cheapestPrice,
      currentProduct: selectedProduct,
      currentPrice: currentPrice,
      savings: currentPrice - cheapestPrice
    };
  } 

  else {
    const discountedPrice = currentPrice * 0.95;
    return {
      type: "discount",
      suggestedPrice: discountedPrice,
      currentProduct: selectedProduct,
      currentPrice: currentPrice,
      discount: 5
    };
  }
}


function saveOrder(region, product, price, isDiscounted = false, alternativeProduct = null) {

  const ordersDir = path.join(__dirname, "orders");
  if (!fs.existsSync(ordersDir)) {
    fs.mkdirSync(ordersDir);
  }

  const order = {
    id: Date.now(),
    date: new Date().toISOString(),
    region: region,
    product: {
      id: product.id,
      name: product.name,
      category: product.category
    },
    price: price,
    isDiscounted: isDiscounted,
    alternativeProduct: alternativeProduct ? {
      id: alternativeProduct.id,
      name: alternativeProduct.name,
      price: getProductPrice(alternativeProduct, region)
    } : null
  };

  const filename = `order_${order.id}.json`;
  const filepath = path.join(ordersDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(order, null, 2), "utf-8");
  console.log(`\n Заявка сохранена в файл: ${filepath}`);
}


async function selectRegion() {
  console.log("\n=== ВЫБОР РЕГИОНА ===");
  for (let i = 0; i < regions.length; i++) {
    console.log(`${i + 1}. ${regions[i]}`);
  }
  const answer = await askQuestion("Выберите номер региона: ");
  const index = parseInt(answer) - 1;
  if (index >= 0 && index < regions.length) {
    return regions[index];
  }
  console.log(" Неверный ввод, попробуйте снова.");
  return selectRegion();
}


async function selectProduct(region) {
  console.log(`\n=== СПИСОК ТОВАРОВ (Цены в ${region}) ===`);
  for (const product of products) {
    const price = getProductPrice(product, region);
    console.log(`${product.id}. ${product.name} — ${price} ₽`);
  }
  const answer = await askQuestion("Выберите ID товара: ");
  const id = parseInt(answer);
  const product = products.find(p => p.id === id);
  if (product) {
    return product;
  }
  console.log(" Неверный ID, попробуйте снова.");
  return selectProduct(region);
}


async function main() {
  console.log("  Добро пожаловать в систему формирования заявок на стройматериалы!");


  const region = await selectRegion();

  
  const selectedProduct = await selectProduct(region);
  const currentPrice = getProductPrice(selectedProduct, region);
  
  console.log(`\n Ваш заказ: ${selectedProduct.name}`);
  console.log(` Цена: ${currentPrice} ₽ (регион ${region})`);


  let confirm = await askQuestion("\n Оформляем заявку? (y/n): ");
  
  if (confirm.toLowerCase() === "y") {
  
    saveOrder(region, selectedProduct, currentPrice, false, null);
    console.log("Спасибо за заказ!");
    rl.close();
    return;
  } 
  else if (confirm.toLowerCase() === "n") {
  
    console.log("\n Подбираем для вас более выгодное предложение...");
    const retention = applyRetentionLogic(selectedProduct, region);
    
    if (retention.type === "alternative") {
      console.log(`\n Мы нашли более дешёвый аналог в той же категории:`);
      console.log(`    ${retention.suggestedProduct.name} — ${retention.suggestedPrice} ₽`);
      console.log(`    Текущий товар: ${retention.currentProduct.name} — ${retention.currentPrice} ₽`);
      console.log(`    Экономия: ${retention.savings} ₽`);
      
      const finalChoice = await askQuestion("\n Оформляем заявку на этот аналог? (y/n): ");
      if (finalChoice.toLowerCase() === "y") {
        saveOrder(region, retention.suggestedProduct, retention.suggestedPrice, false, null);
        console.log("Спасибо за заказ!");
        rl.close();
        return;
      } else {
        console.log(" Заявка отменена. Хорошего дня!");
        rl.close();
        return;
      }
    } 
    else if (retention.type === "discount") {
      console.log(`\n Ваш товар уже самый дешёвый в категории.`);
      console.log(`    Предоставляем скидку 5%: ${retention.currentPrice} ₽ → ${retention.suggestedPrice.toFixed(2)} ₽`);
      
      const finalChoice = await askQuestion("\n Оформляем заявку со скидкой? (y/n): ");
      if (finalChoice.toLowerCase() === "y") {
        saveOrder(region, retention.currentProduct, retention.suggestedPrice, true, null);
        console.log("Спасибо за заказ!");
        rl.close();
        return;
      } else {
        console.log(" Заявка отменена. Хорошего дня!");
        rl.close();
        return;
      }
    }
  } 
  else {
    console.log(" Неверный ввод, попробуйте снова.");
    return main();
  }
}


main().catch(console.error);