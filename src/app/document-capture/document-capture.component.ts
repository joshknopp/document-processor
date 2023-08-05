import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import axios from 'axios';
import * as Tesseract from 'tesseract.js';

@Component({
  selector: 'app-document-capture',
  templateUrl: './document-capture.component.html',
  styleUrls: ['./document-capture.component.scss']
})
export class DocumentCaptureComponent implements AfterViewInit {
  @ViewChild('video', { static: true }) videoElement!: ElementRef;
  @ViewChild('canvas', { static: true }) canvasElement!: ElementRef;
  video!: any;
  canvas!: any;
  captures!: any[];
  category!: string;
  tags: string[] = [];
  sourceText!: string;
  videoDevices!: MediaDeviceInfo[];
  selectedVideoDevice!: MediaDeviceInfo | null;

  constructor() {
    this.captures = [];
  }

  ngAfterViewInit() {
    this.video = this.videoElement.nativeElement;
    this.canvas = this.canvasElement.nativeElement;
  }

  startCamera() {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      this.videoDevices = devices.filter(device => device.kind === 'videoinput');
      if (this.videoDevices.length > 0) {
        this.selectedVideoDevice = this.videoDevices[0]; // Select the first available video device by default
        this.startMediaStream();
      } else {
        console.error('No video devices found.');
      }
    });
  }

  changeCamera(device: MediaDeviceInfo) {
    this.selectedVideoDevice = device;
    this.startMediaStream();
  }
  
  startMediaStream() {
    if (this.selectedVideoDevice) {
      navigator.mediaDevices.getUserMedia({ video: { deviceId: this.selectedVideoDevice.deviceId } })
        .then(stream => {
          this.video.srcObject = stream;
          this.video.play();
        })
        .catch(err => {
          console.error('Error accessing video stream:', err);
        });
    }
  }  

  capture() {
    this.canvas.getContext('2d').drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
    const image = this.canvas.toDataURL('image/png');
    this.captures.push(image);

    // OCR text extraction
    Tesseract.recognize(image)
      .then(result => {
        const extractedText = result.data.text;
        this.sourceText = extractedText;
        //this.processDocument(extractedText);
      })
      .catch(err => {
        console.error('OCR Error:', err);
      });
  }

  processDocument(text: string) {
    // ChatGPT API integration
    const apiUrl = 'YOUR_CHATGPT_API_URL'; // Replace with the actual ChatGPT API URL

    axios.post(apiUrl, {
      text: text
    })
      .then(response => {
        const category = response.data.category;
        const tags = response.data.tags;
        this.displayResults(category, tags);
      })
      .catch(err => {
        console.error('ChatGPT API Error:', err);
      });
  }

  displayResults(category: string, tags: string[]) {
    // Display the results on the screen as desired
    this.category = category;
    this.tags = tags;
  }
}
