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
  capturedImage!: Tesseract.ImageLike | undefined;
  category!: string;
  tags: string[] = [];
  sourceText!: string;
  videoDevices!: MediaDeviceInfo[];
  isReadyToCapture: boolean = false;

  constructor() {
    this.capturedImage = undefined;
  }

  ngAfterViewInit() {
    this.video = this.videoElement.nativeElement;
    this.canvas = this.canvasElement.nativeElement;
    this.getCameraList();
  }

  getCameraList() {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      console.log(devices)
      this.videoDevices = devices.filter(device => device.kind === 'videoinput');
      if (this.videoDevices?.length == 0) {
        console.error('No video devices found.');
      }
    });
  }

  startMediaStream(device: MediaDeviceInfo) {
    this.capturedImage = undefined;
    navigator.mediaDevices.getUserMedia({ video: { deviceId: device.deviceId } })
      .then(stream => {
        this.video.srcObject = stream;
        this.video.play();
      })
      .catch(err => {
        console.error('Error accessing video stream:', err);
      });
  }  

  onVideoEvent(event: any) {
    this.isReadyToCapture = (event?.type === 'loadeddata' || event?.type === 'progress');
  }

  captureImage() {
    setTimeout(async () => {
      this.canvas.getContext('2d').drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
      this.capturedImage = this.canvas.toDataURL('image/png');
      this.video.srcObject = null;
      this.video.load();
      // OCR text extraction
      this.sourceText = '(Extraction pending...)';
      try {
        this.sourceText = await this.extractTextFromImage(this.capturedImage as Tesseract.ImageLike);
      } catch(err) {
        this.sourceText = 'Extraction failed';
        console.error('OCR Error:', err);
      }
    }, 1);
  }

  async extractTextFromImage(image: Tesseract.ImageLike) {
    const result: Tesseract.RecognizeResult = await Tesseract.recognize(image);
    return result.data.text;
  }

  handleOnload(event: any) {
    console.log(event)
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
