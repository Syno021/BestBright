import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StockmovementPage } from './stockmovement.page';

describe('StockmovementPage', () => {
  let component: StockmovementPage;
  let fixture: ComponentFixture<StockmovementPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(StockmovementPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
