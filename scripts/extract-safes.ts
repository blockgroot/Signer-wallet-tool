import * as fs from "fs";

type SafeInfo = {
  url: string;
  network: string;
  chainId: number | null;
  address: string;
};

/**
 * Map Safe network slug → chainId
 * (Update any custom chains if needed)
 */
const NETWORK_CHAIN_ID: Record<string, number> = {
  eth: 1,
  sep: 11155111,

  bnb: 56,
  matic: 137,
  avax: 43114,

  arb1: 42161,
  oeth: 10,        // Optimism
  base: 8453,
  zkevm: 1101,
  zksync: 324,
  linea: 59144,
  blast: 81457,
  scroll: 534352,
  scr: 534352,

  tac: 239,
  xlayer: 196,
  unichain: 130,
  sonic: 146,
  berachain: 80094,
  ink: 57073,
  plasma: 9745,
  stable: 2016,
  "hyper-evm": 999,
  mega: 6342,
  mnt: 5000,
};

/**
 * Extract network + safe address from a Safe transaction URL
 */
function extractSafeInfo(url: string): SafeInfo | null {
  try {
    const parsed = new URL(url.trim());
    const safeParam = parsed.searchParams.get("safe");
    if (!safeParam) return null;

    const [network, address] = safeParam.split(":");
    if (!network || !address) return null;

    return {
      url,
      network,
      chainId: NETWORK_CHAIN_ID[network] ?? null,
      address,
    };
  } catch {
    return null;
  }
}

/**
 * Convert SafeInfo array → CSV string
 */
function toCSV(data: SafeInfo[]): string {
  const header = "network,chainId,address,url\n";
  const rows = data
    .map((s) =>
      `${s.network},${s.chainId ?? ""},${s.address},${s.url}`
    )
    .join("\n");

  return header + rows;
}

/* =========================================================
   🔽 PASTE YOUR RAW TEXT WITH URLs BELOW
   ========================================================= */

const bigText = `
https://app.safe.global/transactions/tx?safe=eth:0xCbcdd778AA25476F203814214dD3E9b9c[…]0b582dfb261d80264a18f1d8b50740af954df21e54744aabfa78b5f308c90https://app.safe.global/transactions/tx?safe=eth:0xEe68dF9f661da6ED968Ea4cbF7EC68fcF[…]7fa1d65f8938e1c2b117a2ab45ebe2ee5c7685db31b04cd2d055607e9e61dhttps://app.safe.global/transactions/tx?safe=bnb:0xb4222155CDB309Ecee1bA64d56c8bAb04[…]2a19dea58518951878eb5edb05da3352eae44246969ee0299a1b599f6bc32https://app.safe.global/transactions/tx?safe=oeth:0x0d30A563e38Fe2926b37783A046004A7[…]4dd9edff1e378dc7ae0b16c9ea481ad8dec442ea5cfbe3852d7c578221c8bhttps://app.safe.global/transactions/tx?safe=arb1:0x96D97D66d4290C9182A09470a5775FF9[…]22a26c540f024a52606fb4165ec43f6e997a9973e08efffb6ca89c0fafda1https://app.safe.global/transactions/tx?safe=arb1:0xd4481D595D99E2BA0E3eDFBd65fBB79b[…]c116799bad230469f5d5d68ded7535f9de882b1a648e6a883f0ac6bb1b0a4https://app.safe.global/transactions/tx?safe=zkevm:0x424Fc153C4005F8D5f23E08d94F5203[…]19b3ac6bc36b9324ebe160f9757d6cb3f591bb6472ff6550fc4d8e8779109https://app.safe.global/transactions/tx?safe=zksync:0xeD38DA849b20Fa27B07D073053C5F5[…]ea96c5df289fda5a3a544539331a28c5233df25fa8f01fdb962afc4c80d5dhttps://app.safe.global/transactions/tx?safe=base:0x7Da95539762Dd11005889F6B72a6674A[…]e42734641ab6a4dd938559455aefb888c79e7ac5f6e8a4213fb81a039c1d8https://app.safe.global/transactions/tx?safe=scr:0xEe68dF9f661da6ED968Ea4cbF7EC68fcF[…]1bccaeb0e7081c55046ed0e22dae8c70f3723de7ef1dd01731993754388eehttps://app.safe.global/transactions/tx?safe=linea:0xEe68dF9f661da6ED968Ea4cbF7EC68f[…]c796d70ce56ff9c61f291b8b22e318f588465a5a622e9792001356590aaeahttps://app.safe.global/transactions/tx?safe=blast:0xEe68dF9f661da6ED968Ea4cbF7EC68f[…]7fa1d65f8938e1c2b117a2ab45ebe2ee5c7685db31b04cd2d055607e9e61dhttps://app.safe.global/transactions/tx?safe=xlayer:0xEe68dF9f661da6ED968Ea4cbF7EC68[…]13e49f022dbc2a72783f4f11bd31eca1c826f06ab38db912b0611959ef55fhttps://app.safe.global/transactions/tx?safe=xlayer:0x449DEFBac8dc846fE51C6f0aBD92d0[…]91e6c461137fab653d4bc090aaa9504ec84933fccc9df6c44b437b3559051https://app.safe.global/transactions/tx?safe=unichain:0x9Fc47d6A2F5A1EFd8BaF475E1873[…]87af709c2928614350c1daf097807a09dcbe92066ad0129daebcc4d595474https://safe.tac.build/transactions/tx?safe=tac:0x3DA6b24D9003228356f7040f6e6b1fa575[…]248c3646717167a8c5c48a778ae1068b75a8ad248bb95805bcbf529352b3dhttps://app.safe.global/transactions/tx?safe=avax:0xB2Bb1425514Ab5903BE6bBDb6b44958e[…]76b0c7b08d43ea1211674f53361ec2ea4612be61f1cb6678fbfe15f7449dbhttps://app.safe.global/transactions/tx?safe=sonic:0xCbcdd778AA25476F203814214dD3E9b[…]e797bf4de0aa9fb96606466f5281ccf22e9e6a312007cc7814378ae6c0d53https://app.safe.global/transactions/tx?safe=berachain:0x7Ac1cE0cB6A7c6eF59c2f95A859[…]4d92893c0f8a12baab8a2c05015c14013337bc3a802e6df70d7561338dc72https://app.safe.global/transactions/tx?safe=ink:0x7a1112494843d0228BFFBa13eF3Ce57f4[…]909988b311d2a128fd2596fb7e96f2ac164faa41d9b6005feb7c87204f34ehttps://app.safe.global/transactions/tx?safe=plasma:0x5Ae348Bb75bC9587290a28636187B8[…]3b9f42e4e54fb9f83a9a2bc949fd0f85e36f93a5ae8a9223b829667a19e73https://app.safe.global/transactions/tx?safe=stable:0x26d60a69f3c9Ac4c9a405A5D3D5454[…]8978528d32c9f22aa1646de9b8686c540c83ee64598964f31a861bb89f952https://app.safe.global/transactions/tx?safe=hyper-evm:0xc58DBA139E376AE06270b3b4669[…]7c96ca988535d3a16d536698bcad571d8fb9ae87e59b5565b24727d777676https://app.safe.global/transactions/tx?safe=mega:0xfa3bA682f2210d05D087b331c71F5b34[…]0d897aa7158b251cb8b0b2071df390eb3856bb06bd0f5887aac707d209e4ahttps://app.safe.global/transactions/tx?safe=mnt:0xfa3bA682f2210d05D087b331c71F5b34F[…]6c19886480b6794d4e96ef898661feff21ac5a0958db9e9c001cfcf3f694ahttps://app.safe.global/transactions/tx?safe=eth:0xb9577E83a6d9A6DE35047aa066E375822[…]d73a7c57a5c6c2d3d334d1be89389c0e93bc38fec204edd686df253aa69dfhttps://app.safe.global/transactions/tx?safe=eth:0x4E9096741c99D035f60abAEbDE8a35c31[…]a23bf40b9e3b11d2a8408aabfae1139c8db77d26baf3a7ffce793e94be6e0
`;

/* =========================================================
   🔼 END INPUT
   ========================================================= */

// 1️⃣ Extract all URLs from the blob of text
const urlRegex = /https?:\/\/[^\s]+/g;
const urls = bigText.match(urlRegex) || [];

// 2️⃣ Parse Safe info
const safes: SafeInfo[] = urls
  .map(extractSafeInfo)
  .filter((x): x is SafeInfo => x !== null);

// 3️⃣ Group by network
const groupedByNetwork: Record<string, SafeInfo[]> = {};

for (const safe of safes) {
  if (!groupedByNetwork[safe.network]) {
    groupedByNetwork[safe.network] = [];
  }
  groupedByNetwork[safe.network].push(safe);
}

// 4️⃣ Export files
fs.writeFileSync("safes.json", JSON.stringify(safes, null, 2));
fs.writeFileSync("safes_grouped.json", JSON.stringify(groupedByNetwork, null, 2));
fs.writeFileSync("safes.csv", toCSV(safes));

console.log(`✅ Done!
- Total Safes found: ${safes.length}
- Networks found: ${Object.keys(groupedByNetwork).join(", ")}
Files created:
  • safes.json
  • safes_grouped.json
  • safes.csv
`);
