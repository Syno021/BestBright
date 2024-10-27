import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { StockmovementPageRoutingModule } from './stockmovement-routing.module';

import { StockmovementPage } from './stockmovement.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    StockmovementPageRoutingModule
  ],
  declarations: [StockmovementPage]
})
export class StockmovementPageModule {}
