# 🏁 Benchmarks

## Order signing benchmarks

Orders that you send to Paradex must be signed. The signature is verified both by Paradex API and during on-chain settlement to ensure that the order was created by you and was not modified.

This section provides an overview of the speed of order signature in currently implemented programming languages.

### Code

* [Benchmarking code for Go, Java, Python, TypeScript](https://github.com/tradeparadex/code-samples)
* [Rust implementation](https://github.com/xJonathanLEI/starknet-rs/blob/master/starknet-crypto/benches/ecdsa\_sign.rs)
* [C++ implementation](https://github.com/tradeparadex/starknet-signing-cpp)

### Benchmarking Results

<table><thead><tr><th width="134">Language</th><th width="253">Signature lib</th><th width="198">Signatures / second</th><th>Signature latency (ms)</th></tr></thead><tbody><tr><td>Go </td><td>Go <code>gnark-crypto</code></td><td>1430</td><td>0.7</td></tr><tr><td>Python  </td><td>Rust <code>starknet-crypto-py</code></td><td>182</td><td>5</td></tr><tr><td>Python </td><td>C++ <code>crypto-cpp-py</code></td><td>8</td><td>119</td></tr><tr><td>Java</td><td>JVM <code>StarknetCurve</code></td><td>182</td><td>5</td></tr><tr><td>Java</td><td>C++ <code>crypto-cpp</code></td><td>8</td><td>119</td></tr><tr><td>TypeScript</td><td>JS <code>starknet.js</code></td><td>50</td><td>20</td></tr><tr><td>Rust</td><td></td><td>5000</td><td>0.2</td></tr><tr><td>C++</td><td></td><td>2500</td><td>0.4</td></tr></tbody></table>
