#!/usr/bin/env python3
"""
FOMO Intelligence API - Endpoint Tester
Tests all endpoints from api_endpoints_registry and marks their status
"""

import subprocess
import json
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# MongoDB connection via mongosh
def mongo_query(query):
    result = subprocess.run(
        ['mongosh', 'fomo_market', '--quiet', '--eval', query],
        capture_output=True, text=True, timeout=30
    )
    return result.stdout.strip()

def test_endpoint(endpoint):
    """Test single endpoint and return result"""
    method = endpoint.get('method', 'GET')
    path = endpoint.get('path', '')
    category = endpoint.get('category', 'unknown')
    
    # Build test URL
    base_url = 'http://localhost:8001'
    test_path = path
    
    # Replace path parameters with test values
    test_path = test_path.replace(':slug', 'bitcoin')
    test_path = test_path.replace(':symbol', 'BTC')
    test_path = test_path.replace(':id', '1')
    test_path = test_path.replace(':investor', 'paradigm')
    test_path = test_path.replace(':address', '0x742d35Cc6634C0532925a3b844Bc9e7595f00000')
    
    url = f"{base_url}{test_path}"
    
    try:
        start = time.time()
        if method == 'GET':
            result = subprocess.run(
                ['curl', '-s', '-w', '\\n%{http_code}', '-X', 'GET', url],
                capture_output=True, text=True, timeout=10
            )
        else:
            result = subprocess.run(
                ['curl', '-s', '-w', '\\n%{http_code}', '-X', method, url,
                 '-H', 'Content-Type: application/json', '-d', '{}'],
                capture_output=True, text=True, timeout=10
            )
        
        elapsed = round((time.time() - start) * 1000)
        output = result.stdout.strip().split('\n')
        status_code = int(output[-1]) if output else 0
        body = '\n'.join(output[:-1])
        
        working = status_code in [200, 201, 204]
        
        return {
            'path': path,
            'method': method,
            'category': category,
            'status_code': status_code,
            'working': working,
            'latency_ms': elapsed,
            'error': None if working else f"HTTP {status_code}"
        }
    except subprocess.TimeoutExpired:
        return {
            'path': path,
            'method': method,
            'category': category,
            'status_code': 0,
            'working': False,
            'latency_ms': 10000,
            'error': 'Timeout'
        }
    except Exception as e:
        return {
            'path': path,
            'method': method,
            'category': category,
            'status_code': 0,
            'working': False,
            'latency_ms': 0,
            'error': str(e)
        }

def main():
    print("=" * 60)
    print("FOMO Intelligence API - Endpoint Tester")
    print("=" * 60)
    
    # Get endpoints from database
    print("\n[1/4] Loading endpoints from database...")
    query = """
    var endpoints = db.api_endpoints_registry.find({}).toArray();
    print(JSON.stringify(endpoints));
    """
    raw = mongo_query(query)
    
    try:
        endpoints = json.loads(raw) if raw else []
    except:
        endpoints = []
    
    print(f"  Found {len(endpoints)} registered endpoints")
    
    if not endpoints:
        print("  No endpoints found in registry!")
        return
    
    # Group by category
    by_category = {}
    for ep in endpoints:
        cat = ep.get('category', 'other')
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(ep)
    
    print(f"  Categories: {', '.join(sorted(by_category.keys()))}")
    
    # Priority categories (core business logic)
    priority_cats = ['funds', 'investors', 'projects', 'persons', 'unlocks', 'intel', 'entities', 'smart-money']
    
    # Test priority endpoints first
    print("\n[2/4] Testing PRIORITY endpoints (funds, investors, projects, persons, unlocks)...")
    
    priority_endpoints = []
    other_endpoints = []
    
    for ep in endpoints:
        cat = ep.get('category', 'other')
        if cat in priority_cats or ep.get('path', '').startswith('/api/intel'):
            priority_endpoints.append(ep)
        else:
            other_endpoints.append(ep)
    
    print(f"  Priority endpoints: {len(priority_endpoints)}")
    print(f"  Other endpoints: {len(other_endpoints)}")
    
    # Test all priority endpoints
    results = {
        'working': [],
        'not_working': [],
        'by_category': {}
    }
    
    tested = 0
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(test_endpoint, ep): ep for ep in priority_endpoints}
        
        for future in as_completed(futures):
            result = future.result()
            tested += 1
            
            cat = result['category']
            if cat not in results['by_category']:
                results['by_category'][cat] = {'working': 0, 'not_working': 0}
            
            if result['working']:
                results['working'].append(result)
                results['by_category'][cat]['working'] += 1
            else:
                results['not_working'].append(result)
                results['by_category'][cat]['not_working'] += 1
            
            if tested % 50 == 0:
                print(f"    Tested {tested}/{len(priority_endpoints)}...")
    
    # Test sample of other endpoints
    print("\n[3/4] Testing sample of OTHER endpoints...")
    
    sample_size = min(100, len(other_endpoints))
    other_sample = other_endpoints[:sample_size]
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(test_endpoint, ep): ep for ep in other_sample}
        
        for future in as_completed(futures):
            result = future.result()
            cat = result['category']
            if cat not in results['by_category']:
                results['by_category'][cat] = {'working': 0, 'not_working': 0}
            
            if result['working']:
                results['working'].append(result)
                results['by_category'][cat]['working'] += 1
            else:
                results['not_working'].append(result)
                results['by_category'][cat]['not_working'] += 1
    
    # Update database with results
    print("\n[4/4] Updating endpoint status in database...")
    
    for result in results['working']:
        update_query = f"""
        db.api_endpoints_registry.updateOne(
          {{ path: "{result['path']}", method: "{result['method']}" }},
          {{ $set: {{ working: true, status: "active", last_tested: new Date(), latency_ms: {result['latency_ms']} }} }}
        );
        """
        mongo_query(update_query)
    
    for result in results['not_working']:
        error = (result.get('error') or '').replace('"', '\\"')
        update_query = f"""
        db.api_endpoints_registry.updateOne(
          {{ path: "{result['path']}", method: "{result['method']}" }},
          {{ $set: {{ working: false, status: "inactive", last_tested: new Date(), error: "{error}" }} }}
        );
        """
        mongo_query(update_query)
    
    # Print summary
    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)
    
    total_tested = len(results['working']) + len(results['not_working'])
    print(f"\nTotal tested: {total_tested}")
    print(f"Working: {len(results['working'])} ({100*len(results['working'])//total_tested}%)")
    print(f"Not working: {len(results['not_working'])} ({100*len(results['not_working'])//total_tested}%)")
    
    print("\n--- By Category ---")
    for cat in sorted(results['by_category'].keys()):
        stats = results['by_category'][cat]
        total = stats['working'] + stats['not_working']
        print(f"  {cat}: {stats['working']}/{total} working")
    
    print("\n--- WORKING Priority Endpoints ---")
    for r in sorted(results['working'], key=lambda x: x['category'])[:30]:
        if r['category'] in priority_cats:
            print(f"  ✓ {r['method']} {r['path']} ({r['latency_ms']}ms)")
    
    print("\n--- NOT WORKING Priority Endpoints ---")
    for r in sorted(results['not_working'], key=lambda x: x['category'])[:30]:
        if r['category'] in priority_cats:
            print(f"  ✗ {r['method']} {r['path']} - {r['error']}")
    
    # Save results to file
    report = {
        'timestamp': datetime.now().isoformat(),
        'total_tested': total_tested,
        'working_count': len(results['working']),
        'not_working_count': len(results['not_working']),
        'by_category': results['by_category'],
        'working_endpoints': results['working'][:100],
        'not_working_endpoints': results['not_working'][:100]
    }
    
    with open('/app/test_reports/endpoints_test_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\nFull report saved to /app/test_reports/endpoints_test_report.json")

if __name__ == '__main__':
    main()
