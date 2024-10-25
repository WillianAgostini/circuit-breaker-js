export * from "./circuitBreaker";
export * from "./state";
export * from "./interfaces";


// (async () => {
//     const promise = new Promise(resolve => setTimeout(resolve, 10));

//     const breaker = new CircuitBreaker({ timeout: 1000 });
//     try {
//         await breaker.execute(promise)
//     } catch (error) {
//         console.log(error)
//     }

// })()