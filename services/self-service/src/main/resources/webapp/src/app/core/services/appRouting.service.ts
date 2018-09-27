/***************************************************************************

Copyright (c) 2016, EPAM SYSTEMS INC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

****************************************************************************/

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable()
export class AppRoutingService {
  constructor(private router: Router) { }

  redirectToLoginPage(): void {
    if (this.router.url !== '/login')
      this.router.navigate(['/login']);
  }

  redirectToHomePage(): void {
    this.router.navigate(['/resources_list']);
  }

  redirectToHealthStatusPage(): void {
    this.router.navigate(['/environment_health_status']);
  }

  redirectToAzure(): void {
    window.location.href =  `${ window.location.origin }/api/dex/init`;
  }
}
