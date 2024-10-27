import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { StockmovementPage } from './stockmovement.page';

const routes: Routes = [
  {
    path: '',
    component: StockmovementPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StockmovementPageRoutingModule {}
