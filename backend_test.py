#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class FOMOAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.passed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, timeout=30):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.passed_tests.append(name)
                print(f"✅ Passed - Status: {response.status_code}")
                
                # Try to parse JSON response
                try:
                    json_response = response.json()
                    if isinstance(json_response, dict):
                        if 'count' in json_response:
                            print(f"   Data count: {json_response['count']}")
                        if 'ok' in json_response:
                            print(f"   Status: {json_response['ok']}")
                        if 'service' in json_response:
                            print(f"   Service: {json_response['service']}")
                except:
                    print(f"   Response length: {len(response.text)} chars")
                    
            else:
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200] if response.text else 'No response'
                })
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            return success, response.json() if success and response.text else {}

        except requests.exceptions.Timeout:
            self.failed_tests.append({
                'name': name,
                'error': 'Request timeout',
                'timeout': timeout
            })
            print(f"❌ Failed - Request timeout after {timeout}s")
            return False, {}
        except Exception as e:
            self.failed_tests.append({
                'name': name,
                'error': str(e)
            })
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )

    def test_auth_verify(self, password="fomo2024"):
        """Test auth verification"""
        return self.run_test(
            "Auth Verify",
            "POST",
            "api/auth/verify",
            201,
            data={"password": password}
        )

    def test_intel_funds(self):
        """Test intel funds endpoint"""
        return self.run_test(
            "Intel Funds",
            "GET",
            "api/intel/funds",
            200
        )

    def test_intel_projects(self):
        """Test intel projects endpoint"""
        return self.run_test(
            "Intel Projects",
            "GET",
            "api/intel/projects",
            200
        )

    def test_intel_investors_top(self):
        """Test intel investors endpoint"""
        return self.run_test(
            "Intel Investors Top",
            "GET",
            "api/intel/investors",
            200
        )

    def test_intel_stats(self):
        """Test intel stats endpoint"""
        return self.run_test(
            "Intel Stats",
            "GET",
            "api/intel/stats",
            200
        )

    def test_entities_stats(self):
        """Test entities stats endpoint"""
        return self.run_test(
            "Entity Stats",
            "GET",
            "api/entities/stats",
            200
        )

    def test_smart_money_stats(self):
        """Test smart money stats endpoint"""
        return self.run_test(
            "Smart Money Stats",
            "GET",
            "api/smart-money/stats",
            200
        )

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test(
            "Root API Info",
            "GET",
            "api/",
            200
        )

def main():
    print("🚀 Starting FOMO Crypto Intelligence API Tests")
    print("=" * 60)
    
    # Setup
    tester = FOMOAPITester()
    
    # Run all tests
    print("\n📋 Running Backend API Tests...")
    
    # Basic health and info
    tester.test_health_check()
    tester.test_root_endpoint()
    
    # Authentication
    tester.test_auth_verify()
    
    # Intel endpoints
    tester.test_intel_stats()
    tester.test_intel_funds()
    tester.test_intel_projects()
    tester.test_intel_investors_top()
    
    # Entity and Smart Money endpoints
    tester.test_entities_stats()
    tester.test_smart_money_stats()

    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.passed_tests:
        print(f"\n✅ Passed Tests ({len(tester.passed_tests)}):")
        for test in tester.passed_tests:
            print(f"   • {test}")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests ({len(tester.failed_tests)}):")
        for test in tester.failed_tests:
            error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
            print(f"   • {test['name']}: {error_msg}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())