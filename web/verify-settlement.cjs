async function runTests() {
  console.log("Starting Settlements and Currency Conversions Unit Tests...");

  try {
    const { convertCurrency, calculateSettlements } = await import('./src/utils/currency.js');

    // 1. Test convertCurrency
    console.log("1. Testing convertCurrency...");
    const mockRates = {
      USD: 1.0,
      EUR: 0.92,
      GBP: 0.78
    };

    // EUR to USD: 100 EUR -> USD (100 / 0.92 * 1.0)
    const eurToUsd = convertCurrency(100, 'EUR', 'USD', mockRates);
    const expectedEurToUsd = 100 / 0.92 * 1.0;
    if (Math.abs(eurToUsd - expectedEurToUsd) > 0.001) {
      throw new Error(`convertCurrency failed EUR -> USD. Got: ${eurToUsd}, Expected: ${expectedEurToUsd}`);
    }

    // USD to EUR: 50 USD -> EUR (50 / 1.0 * 0.92)
    const usdToEur = convertCurrency(50, 'USD', 'EUR', mockRates);
    const expectedUsdToEur = 50 / 1.0 * 0.92;
    if (Math.abs(usdToEur - expectedUsdToEur) > 0.001) {
      throw new Error(`convertCurrency failed USD -> EUR. Got: ${usdToEur}, Expected: ${expectedUsdToEur}`);
    }

    // Same currency:
    const usdToUsd = convertCurrency(75, 'USD', 'USD', mockRates);
    if (usdToUsd !== 75) {
      throw new Error(`convertCurrency failed USD -> USD. Got: ${usdToUsd}, Expected: 75`);
    }

    // Missing rate fallback:
    const audToUsd = convertCurrency(60, 'AUD', 'USD', mockRates);
    if (audToUsd !== 60) {
      throw new Error(`convertCurrency failed missing rate fallback. Got: ${audToUsd}, Expected: 60`);
    }

    console.log("✓ convertCurrency tests passed.");

    // 2. Test calculateSettlements
    console.log("2. Testing calculateSettlements solver algorithm...");

    // Test Case 1: Alice spent $90 ($30 share), Bob spent $30 ($30 share), Charlie spent $0 ($30 share)
    // Alice net: +60, Bob net: 0, Charlie net: -60. Charlie owes Alice $60.
    // Let's model:
    // Alice: paid 90, owed 30 -> Net +60
    // Bob: paid 30, owed 30 -> Net 0
    // Charlie: paid 0, owed 30 -> Net -60
    const mockBalances1 = {
      userA: { userId: 'userA', name: 'Alice', paid: 90, owed: 30 },
      userB: { userId: 'userB', name: 'Bob', paid: 30, owed: 30 },
      userC: { userId: 'userC', name: 'Charlie', paid: 0, owed: 60 }
    };

    const txs1 = calculateSettlements(mockBalances1);
    if (txs1.length !== 1) {
      throw new Error(`calculateSettlements Test Case 1 failed: expected 1 transaction, got ${txs1.length}`);
    }
    const t1 = txs1[0];
    if (t1.fromName !== 'Charlie' || t1.toName !== 'Alice' || Math.abs(t1.amount - 60) > 0.001) {
      throw new Error(`calculateSettlements Test Case 1 failed: expected Charlie to owe Alice 60, got ${JSON.stringify(t1)}`);
    }

    // Test Case 2: Alice net +50, Bob net -10, Charlie net -40
    const mockBalances2 = {
      userA: { userId: 'userA', name: 'Alice', paid: 90, owed: 40 },
      userB: { userId: 'userB', name: 'Bob', paid: 30, owed: 40 },
      userC: { userId: 'userC', name: 'Charlie', paid: 0, owed: 40 }
    };

    const txs2 = calculateSettlements(mockBalances2);
    if (txs2.length !== 2) {
      throw new Error(`calculateSettlements Test Case 2 failed: expected 2 transactions, got ${txs2.length}`);
    }
    // Verify that Charlie owes Alice 40, Bob owes Alice 10
    const charlieToAlice = txs2.find(t => t.fromName === 'Charlie' && t.toName === 'Alice');
    const bobToAlice = txs2.find(t => t.fromName === 'Bob' && t.toName === 'Alice');

    if (!charlieToAlice || Math.abs(charlieToAlice.amount - 40) > 0.001) {
      throw new Error(`Expected Charlie to owe Alice 40. Got: ${JSON.stringify(charlieToAlice)}`);
    }
    if (!bobToAlice || Math.abs(bobToAlice.amount - 10) > 0.001) {
      throw new Error(`Expected Bob to owe Alice 10. Got: ${JSON.stringify(bobToAlice)}`);
    }

    // Test Case 3: Everyone even
    const mockBalances3 = {
      userA: { userId: 'userA', name: 'Alice', paid: 30, owed: 30 },
      userB: { userId: 'userB', name: 'Bob', paid: 30, owed: 30 }
    };
    const txs3 = calculateSettlements(mockBalances3);
    if (txs3.length !== 0) {
      throw new Error(`calculateSettlements Test Case 3 failed: expected 0 transactions, got ${txs3.length}`);
    }

    console.log("✓ calculateSettlements solver tests passed.");
    console.log("All Settlements verification tests Completed Successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed:", err.message || err);
    process.exit(1);
  }
}

runTests();
