import http from "k6/http";
import { sleep, check } from "k6";
import { randomIntBetween, uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const customers = [
  "4e8d1455-c201-474f-a74d-4df1acb2978c",
  "4e8d1455-c201-474f-a74d-4df1acb2978d",
  "4e8d1455-c201-474f-a74d-4df1acb2978e",
  "4e8d1455-c201-474f-a74d-4df1acb2978f",
  "4e8d1455-c201-474f-a74d-4df1acb29790",
];

const products = [
  "e1690c12-1000-4b01-b4b1-000000000006",
  "e1690c12-1000-4b01-b4b1-000000000003",
  "e1690c12-1000-4b01-b4b1-000000000004",
  "e1690c12-1000-4b01-b4b1-000000000005",
  "e1690c12-1000-4b01-b4b1-000000000007",
];

function pick(arr) {
  return arr[randomIntBetween(0, arr.length - 1)];
}

function buildPayload() { 
  const itemCount = randomIntBetween(1,3);

  const items = Array.from({ length: itemCount }, () => ({
    productId: pick(products),
    quantity: randomIntBetween(1, 3),
  }));

  return JSON.stringify({
    customerId: pick(customers),
    items,
  });
}
 
export const options = {
  stages: [
    { duration: "1m", target: 10 },
    { duration: "2m", target: 30 },
    { duration: "2m", target: 50 },  
    { duration: "3m", target: 50 },  
    { duration: "1m", target: 30 },
    { duration: "1m", target: 0 },
  ],

  insecureSkipTLSVerify: true,
  noConnectionReuse: false,

  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"], 
  },
};


export default function () {
  const baseUrl = __ENV.BASE_URL || "http://proxy.localhost";

  const payload = buildPayload();

  const params = {
    headers: {
      "Content-Type": "application/json", 
      "Idempotency-Key": uuidv4(),
    },
    tags: {
      endpoint: "create_order",
    },
    timeout: "30s",
  };

  const res = http.post(`${baseUrl}/order/api/orders`, payload, params);

  check(res, {
    "order accepted (200/202)": (r) => r.status === 202 || r.status === 200,
  });
 
  sleep(randomIntBetween(0, 2) * 0.2);  
}
