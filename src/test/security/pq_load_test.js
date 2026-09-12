import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 50 },  // Ramp-up to 50 virtual users
    { duration: '10s', target: 100 }, // Hold at 100 VUs (stress test)
    { duration: '5s', target: 0 },   // Ramp-down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'], // 95% of requests must complete below 100ms
    http_req_failed: ['rate<0.01'],   // Error rate must be less than 1%
  },
};

// Simulated valid hybrid JWT token
const VALID_HYBRID_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsIngtcHEtYWxnIjoiTUwtRFNBLTY1IiwieC1wcS1zaWciOiJaeEZ5WlhoamRDMWhkSFZ5Wlhac1lXZGxkQzFoZFhSb2NtVmxkR2x5WVc1bGMzTnZjR2xuYm1GMGRYSmxjM1Z5WlhKMWMybHlaV2QxWVdsMGN5MTFlSFE9In0.eyJzdWIiOiJkMDJiOWE4OS01MTIwLTRmMmEtYTE3Ny01ZDUwZTg3ZWYyZmQiLCJ1c2VybmFtZSI6InRlc3RfdXNlciIsImV4cCI6OTk5OTk5OTk5OX0.classic_signature_part';

// Simulated invalid hybrid JWT token (bad PQ signature)
const INVALID_HYBRID_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsIngtcHEtYWxnIjoiTUwtRFNBLTY1IiwieC1wcS1zaWciOiJpbnZhbGlkX3NpZyJ9.eyJzdWIiOiJkMDJiOWE4OS01MTIwLTRmMmEtYTE3Ny01ZDUwZTg3ZWYyZmQiLCJ1c2VybmFtZSI6InRlc3RfdXNlciIsImV4cCI6OTk5OTk5OTk5OX0.classic_signature_part';

export default function () {
  const url = 'http://localhost:8080/api/identity/profile';
  
  // 1. Send valid request (valid hybrid token)
  const paramsValid = {
    headers: {
      'Authorization': `Bearer ${VALID_HYBRID_JWT}`,
      'Content-Type': 'application/json',
    },
  };
  const resValid = http.get(url, paramsValid);
  check(resValid, {
    'valid token status is 200 or 2xx': (r) => r.status >= 200 && r.status < 300,
    'valid token response time < 50ms': (r) => r.timings.duration < 50,
  });

  sleep(0.1);

  // 2. Send invalid request (bad signature) to test Gateway rejection performance
  const paramsInvalid = {
    headers: {
      'Authorization': `Bearer ${INVALID_HYBRID_JWT}`,
      'Content-Type': 'application/json',
    },
  };
  const resInvalid = http.get(url, paramsInvalid);
  check(resInvalid, {
    'invalid token status is 401': (r) => r.status === 401,
  });

  sleep(0.1);
}
