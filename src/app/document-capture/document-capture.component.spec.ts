import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentCaptureComponent } from './document-capture.component';

describe('DocumentCaptureComponent', () => {
  let component: DocumentCaptureComponent;
  let fixture: ComponentFixture<DocumentCaptureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DocumentCaptureComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DocumentCaptureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
