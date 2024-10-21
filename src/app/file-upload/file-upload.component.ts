import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss'],
})
export class FileUploadComponent implements OnInit {
  @Input() orderId!: number;
  selectedFile: File | null = null;

  constructor(
    private modalController: ModalController,
    private storage: AngularFireStorage,
    private firestore: AngularFirestore
  ) { }

  ngOnInit() {}

  dismissModal() {
    this.modalController.dismiss();
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0] as File;
  }

  async uploadFile() {
    if (this.selectedFile) {
      const filePath = `order_documents/${this.orderId}/${this.selectedFile.name}`;
      const fileRef = this.storage.ref(filePath);
      const task = this.storage.upload(filePath, this.selectedFile);

      try {
        await task;
        const downloadURL = await fileRef.getDownloadURL().toPromise();
        await this.firestore.collection('uploads').doc(this.orderId.toString()).set({
          documentURL: downloadURL,
          documentName: this.selectedFile.name
        }, { merge: true });
        this.dismissModal();
      } catch (error) {
        console.error('Error uploading file:', error);
        // Handle error (e.g., show error message to user)
      }
    }
  }
}