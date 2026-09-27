import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

// jsdom doesn't implement IntersectionObserver — several marketing components
// use it for scroll-in animations and just need it to exist, not to fire.
class MockIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver;

// Providers every spec needs by default (HttpClient, a routed ActivatedRoute)
// so a plain "should create" test doesn't have to wire them up by hand. A
// spec that cares about a specific route/query param overrides ActivatedRoute
// itself in its own TestBed.configureTestingModule.
setupZoneTestEnv({
  extraProviders: [
    provideHttpClient(),
    provideHttpClientTesting(),
    {
      provide: ActivatedRoute,
      useValue: {
        snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
        paramMap: { subscribe: () => ({ unsubscribe: () => {} }) },
      },
    },
  ],
});
