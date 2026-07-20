import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import * as THREE from 'three';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.html',
  styleUrls: ['./landing.css']
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  authService = inject(AuthService);
  router = inject(Router);

  @ViewChild('heroCanvas', { static: false }) heroCanvas!: ElementRef<HTMLCanvasElement>;

  currentTheme: 'dark' = 'dark';
  currentYear = new Date().getFullYear();

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private cardMesh!: THREE.Mesh;
  private orbMesh!: THREE.Mesh;
  private particlesMesh!: THREE.Points;
  private animationFrameId?: number;

  private mouseX = 0;
  private mouseY = 0;
  private targetX = 0;
  private targetY = 0;
  private windowHalfX = window.innerWidth / 2;
  private windowHalfY = window.innerHeight / 2;

  // Active Tab for Live Preview
  activePreviewTab: 'overview' | 'analytics' | 'ai' = 'overview';

  // FAQ Items
  faqItems = [
    {
      q: 'How does Gemini AI analyze my financial telemetry?',
      a: 'Google Gemini AI securely analyzes transaction records, income channels, and category allocations to discover cost optimizations and growth opportunities without exposing sensitive credentials.',
      open: true
    },
    {
      q: 'Is my enterprise data protected with banking standards?',
      a: 'Yes. We utilize JWT token authentication, BCrypt password hashing, encrypted MongoDB clusters, and HTTPS SSL channels adhering to strict banking standards.',
      open: false
    },
    {
      q: 'Can I export financial audits for corporate taxes?',
      a: 'Yes! Instant institutional-grade PDF and CSV statement generation is available with full chart visuals, itemized ledgers, and category summaries.',
      open: false
    },
    {
      q: 'Is there a transaction or log restriction on Centurion?',
      a: 'The Centurion Enterprise platform offers unlimited transaction logs, real-time budget thresholds, multi-currency ledger tools, and bespoke Gemini AI advice.',
      open: false
    }
  ];

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  ngAfterViewInit(): void {
    if (this.heroCanvas) {
      this.initThreeJS();
      window.addEventListener('mousemove', this.onMouseMove.bind(this));
      window.addEventListener('resize', this.onWindowResize.bind(this));
    }
  }

  private initThreeJS(): void {
    const canvas = this.heroCanvas.nativeElement;
    const width = canvas.parentElement?.clientWidth || window.innerWidth;
    const height = 450;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.z = 7;

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    const bluePointLight = new THREE.PointLight(0x4f7cff, 3.5, 100);
    bluePointLight.position.set(5, 5, 5);
    this.scene.add(bluePointLight);

    const indigoPointLight = new THREE.PointLight(0x7c5cff, 2.5, 100);
    indigoPointLight.position.set(-5, -5, 5);
    this.scene.add(indigoPointLight);

    // 4. Create 3D Metallic Credit Card
    const cardGeometry = new THREE.BoxGeometry(3.4, 2.15, 0.08);
    const cardMaterial = new THREE.MeshStandardMaterial({
      color: 0x101114,
      metalness: 0.95,
      roughness: 0.15,
      wireframe: false
    });
    this.cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);
    this.cardMesh.position.set(-0.8, 0, 0);
    this.scene.add(this.cardMesh);

    // Add Electric Edge Overlay
    const edgeGeometry = new THREE.BoxGeometry(3.42, 2.17, 0.02);
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x4f7cff,
      metalness: 1.0,
      roughness: 0.05
    });
    const edgeMesh = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edgeMesh.position.set(0, 0, -0.04);
    this.cardMesh.add(edgeMesh);

    // 5. Create Floating 3D AI Orb
    const orbGeometry = new THREE.IcosahedronGeometry(0.85, 2);
    const orbMaterial = new THREE.MeshStandardMaterial({
      color: 0x7c5cff,
      wireframe: true,
      metalness: 0.85,
      roughness: 0.15
    });
    this.orbMesh = new THREE.Mesh(orbGeometry, orbMaterial);
    this.orbMesh.position.set(2.2, 0.6, 0.5);
    this.scene.add(this.orbMesh);

    // 6. Create Particles
    const particlesCount = 250;
    const posArray = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 12;
    }
    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.035,
      color: 0x4f7cff,
      transparent: true,
      opacity: 0.75
    });
    this.particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    this.scene.add(this.particlesMesh);

    this.animate();
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    this.targetX = (this.mouseX - this.windowHalfX) * 0.0005;
    this.targetY = (this.mouseY - this.windowHalfY) * 0.0005;

    if (this.cardMesh) {
      this.cardMesh.rotation.y += (this.targetX - this.cardMesh.rotation.y) * 0.05;
      this.cardMesh.rotation.x += (this.targetY - this.cardMesh.rotation.x) * 0.05;
      this.cardMesh.position.y = Math.sin(Date.now() * 0.0015) * 0.12;
    }

    if (this.orbMesh) {
      this.orbMesh.rotation.x += 0.008;
      this.orbMesh.rotation.y += 0.012;
      this.orbMesh.position.y = 0.6 + Math.cos(Date.now() * 0.002) * 0.15;
    }

    if (this.particlesMesh) {
      this.particlesMesh.rotation.y += 0.0008;
    }

    this.renderer.render(this.scene, this.camera);
  }

  private onMouseMove(event: MouseEvent): void {
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;
  }

  private onWindowResize(): void {
    if (!this.heroCanvas || !this.renderer || !this.camera) return;
    const canvas = this.heroCanvas.nativeElement;
    const width = canvas.parentElement?.clientWidth || window.innerWidth;
    const height = 450;
    this.windowHalfX = width / 2;
    this.windowHalfY = height / 2;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  toggleFaq(index: number): void {
    this.faqItems[index].open = !this.faqItems[index].open;
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('mousemove', this.onMouseMove.bind(this));
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }
}
