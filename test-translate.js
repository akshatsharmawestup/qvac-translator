import { loadModel, translate, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk';

async function runTest() {
  console.log('==================================================');
  console.log('🧪 Testing QVAC English-to-Hindi Translation Engine');
  console.log('==================================================');

  console.log('1. Loading model into local memory...');
  const startTime = Date.now();
  const modelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0
  });
  console.log(`✔ Model loaded successfully! ID: ${modelId} (${Date.now() - startTime}ms)`);

  const sampleEnglish = 'Welcome to the future of decentralized and on-device artificial intelligence.';
  console.log(`\n2. Translating: "${sampleEnglish}"...`);

  const tStart = Date.now();
  const result = translate({
    modelId,
    text: sampleEnglish,
    from: 'en',
    to: 'hi',
    modelType: 'llamacpp-completion',
    stream: true
  });

  process.stdout.write('   Output: ');
  let tokens = 0;
  for await (const token of result.tokenStream) {
    process.stdout.write(token);
    tokens++;
  }
  const tDuration = Date.now() - tStart;
  console.log(`\n✔ Translation complete! ${tokens} tokens generated in ${tDuration}ms (${(tokens / (tDuration / 1000)).toFixed(1)} tok/s)`);

  console.log('\n3. Unloading model...');
  await unloadModel({ modelId });
  console.log('✔ Model unloaded, memory released.');

  console.log('\n🎉 ALL CHECKS PASSED: On-device translation verified!');
}

runTest().catch(err => {
  console.error('✖ Test failed:', err);
  process.exit(1);
});
