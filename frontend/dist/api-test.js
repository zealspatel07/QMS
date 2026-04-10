// Test script to verify API endpoints
// Run this in the browser console on http://localhost:5173

async function testAPI() {
  console.log("🧪 Testing API Endpoints...\n");

  const apiBase = "http://localhost:4000";

  // Test 1: Customers
  console.log("1️⃣ Testing GET /api/customers");
  try {
    const res = await fetch(`${apiBase}/api/customers`);
    const data = await res.json();
    console.log(`✅ Status: ${res.status}`);
    console.log(`✅ Customers found: ${data.length}`);
    if (data.length > 0) {
      console.log(`✅ Sample customer:`, data[0]);
    }
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
  }

  console.log("\n2️⃣ Testing GET /api/products");
  try {
    const res = await fetch(`${apiBase}/api/products`);
    const data = await res.json();
    console.log(`✅ Status: ${res.status}`);
    console.log(`✅ Products found: ${data.length}`);
    if (data.length > 0) {
      console.log(`✅ Sample product:`, data[0]);
    }
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
  }

  console.log("\n3️⃣ Testing Server Health");
  try {
    const res = await fetch(`${apiBase}/api/health`);
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ Server is healthy:`, data);
    } else {
      console.log(`⚠️ Server responded with status ${res.status}`);
    }
  } catch (err) {
    console.error(`❌ Server not responding: ${err.message}`);
  }

  console.log("\n✨ Testing complete!");
}

// Run it
testAPI();
