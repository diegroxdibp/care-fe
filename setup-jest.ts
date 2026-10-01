import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

// jsdom doesn't implement IntersectionObserver — several marketing components
// use it for scroll-in animations and just need it to exist, not to fire.
class MockIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver;

setupZoneTestEnv();

// Providers every spec needs by default (HttpClient, a routed ActivatedRoute,
// animations) so a plain "should create" test doesn't have to wire them up by
// hand. A spec that cares about a specific route/query param overrides
// ActivatedRoute in its own TestBed.configureTestingModule — later providers win.
//
// They go in the testing module, not in setupZoneTestEnv's extraProviders:
// those are *platform* providers, and the platform injector has no
// EnvironmentInjector — every spec that injected HttpClient failed with
// "No provider found for EnvironmentInjector".
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideNoopAnimations(),
      {
        provide: ActivatedRoute,
        // A route with no params, no data and no children — what a component
        // sees on a bare URL. Observables (not hand-rolled subscribe stubs) so
        // anything that pipes them works too.
        useValue: {
          snapshot: {
            params: {},
            queryParams: {},
            data: {},
            paramMap: convertToParamMap({}),
            queryParamMap: convertToParamMap({}),
          },
          params: of({}),
          queryParams: of({}),
          data: of({}),
          paramMap: of(convertToParamMap({})),
          queryParamMap: of(convertToParamMap({})),
          firstChild: null,
        },
      },
    ],
  });
});
