import { Component, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { clearStoredSchedulingNext, readStoredSchedulingNext } from '../../shared/utils/scheduling-next.util';

@Component({
  selector: 'app-callback',
  imports: [],
  templateUrl: './callback.component.html',
  styleUrl: './callback.component.scss',
})
export class CallbackComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
    this.auth.refreshSession().subscribe({
      next: () => {
        // Google OAuth is a full-page redirect round trip, so any `next`
        // captured before it (query param on /scheduling/conta or
        // /auth/signin) only survives here via localStorage.
        const next = readStoredSchedulingNext();
        clearStoredSchedulingNext();
        this.router.navigateByUrl(next ?? '/dashboard');
      },
      error: () => {
        this.router.navigate(['/auth/login']);
      },
    });
  }
}
