import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { MyRequestsService } from './my-requests.service';
import { SessionService } from '../../shared/services/session.service';
import { User } from '../../auth/user.model';

/** "Meus pedidos" só aparece nos menus para quem tem pedidos. */
describe('MyRequestsService', () => {
  let service: MyRequestsService;
  let session: SessionService;
  let http: HttpTestingController;

  const user = (id: number): User => ({ id, email: `p${id}@example.com`, roles: [], profileCompleted: true });
  const mine = () => http.expectOne(r => r.url.endsWith('/api/reviews/mine'));

  beforeEach(() => {
    service = TestBed.inject(MyRequestsService);
    session = TestBed.inject(SessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('does not ask while signed out', () => {
    TestBed.tick();
    http.expectNone(r => r.url.endsWith('/api/reviews/mine'));
    expect(service.hasRequests()).toBe(false);
  });

  it('shows the link once the signed-in person has a request', () => {
    session.setUser(user(1));
    TestBed.tick();
    mine().flush([{ kind: 'PROPOSAL', id: 6 }]);
    expect(service.hasRequests()).toBe(true);
  });

  it('keeps it hidden for someone with no requests', () => {
    session.setUser(user(1));
    TestBed.tick();
    mine().flush([]);
    expect(service.hasRequests()).toBe(false);
  });

  it('does not ask again when the same person saves the profile', () => {
    session.setUser(user(1));
    TestBed.tick();
    mine().flush([{ kind: 'PROPOSAL', id: 6 }]);

    session.updateUser({ name: 'Outro nome' });
    TestBed.tick();

    http.expectNone(r => r.url.endsWith('/api/reviews/mine'));
    expect(service.hasRequests()).toBe(true);
  });

  it('forgets the previous account on sign-out', () => {
    session.setUser(user(1));
    TestBed.tick();
    mine().flush([{ kind: 'PROPOSAL', id: 6 }]);

    session.clear();
    TestBed.tick();

    expect(service.hasRequests()).toBe(false);
  });

  it('refresh() picks up a request just sent', () => {
    session.setUser(user(1));
    TestBed.tick();
    mine().flush([]);

    service.refresh();
    mine().flush([{ kind: 'PROPOSAL', id: 7 }]);

    expect(service.hasRequests()).toBe(true);
  });
});
