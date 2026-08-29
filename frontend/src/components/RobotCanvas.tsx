import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface RobotCanvasProps {
  onInteract?: () => void;
}

export const RobotCanvas: React.FC<RobotCanvasProps> = ({ onInteract }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // --- Scene, Camera, Renderer ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x0a101d, 2.5);
    scene.add(ambientLight);

    const cyanPointLight = new THREE.PointLight(0x2de7d3, 4, 15);
    cyanPointLight.position.set(3, 3, 4);
    scene.add(cyanPointLight);

    const purplePointLight = new THREE.PointLight(0xa855f7, 4, 15);
    purplePointLight.position.set(-3, -2, 3);
    scene.add(purplePointLight);

    const blueLight = new THREE.DirectionalLight(0x38bdf8, 2);
    blueLight.position.set(0, 5, 5);
    scene.add(blueLight);

    // --- Robot Group ---
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);

    // 1. Robot Head Base (Sleek Futuristic Helmet/Chassis)
    const headGeo = new THREE.SphereGeometry(1.2, 64, 64);
    headGeo.scale(1, 1.15, 0.95);
    const chassisMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f1422,
      metalness: 0.85,
      roughness: 0.18,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      reflectivity: 0.9,
    });
    const head = new THREE.Mesh(headGeo, chassisMat);
    robotGroup.add(head);

    // 2. Head Armor Plates (Ear/Side Panels)
    const earGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 32);
    earGeo.rotateZ(Math.PI / 2);
    const earMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.3,
    });
    const leftEar = new THREE.Mesh(earGeo, earMat);
    leftEar.position.set(-1.25, 0.1, 0);
    robotGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, earMat);
    rightEar.position.set(1.25, 0.1, 0);
    robotGroup.add(rightEar);

    // Glowing Ear Rings
    const earRingGeo = new THREE.TorusGeometry(0.38, 0.03, 16, 32);
    earRingGeo.rotateY(Math.PI / 2);
    const glowCyanMat = new THREE.MeshBasicMaterial({ color: 0x2de7d3 });
    const leftEarRing = new THREE.Mesh(earRingGeo, glowCyanMat);
    leftEarRing.position.set(-1.3, 0.1, 0);
    robotGroup.add(leftEarRing);

    const rightEarRing = new THREE.Mesh(earRingGeo, glowCyanMat);
    rightEarRing.position.set(1.3, 0.1, 0);
    robotGroup.add(rightEarRing);

    // 3. Curved Glass Visor (Glossy Black Face Shield)
    const visorGeo = new THREE.SphereGeometry(1.05, 48, 48, 0, Math.PI);
    visorGeo.rotateY(-Math.PI / 2);
    visorGeo.scale(0.9, 0.65, 0.85);
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x05070d,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.4,
      transparent: true,
      opacity: 0.95,
      clearcoat: 1.0,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.05, 0.35);
    robotGroup.add(visor);

    // 4. Cybernetic Glowing Eyes (Curved Dynamic Ovals)
    const eyeGroup = new THREE.Group();
    const eyeGeo = new THREE.CapsuleGeometry(0.12, 0.28, 16, 32);
    eyeGeo.rotateZ(Math.PI / 2);

    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0x2de7d3,
    });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.42, 0.12, 1.08);
    leftEye.rotation.z = -0.08;
    eyeGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.42, 0.12, 1.08);
    rightEye.rotation.z = 0.08;
    eyeGroup.add(rightEye);

    robotGroup.add(eyeGroup);

    // 5. Floating Antenna / Neural Uplink Crown
    const crownGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 16);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.2,
    });
    const antenna = new THREE.Mesh(crownGeo, crownMat);
    antenna.position.set(0, 1.45, -0.1);
    robotGroup.add(antenna);

    const antennaTipGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const antennaTipMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
    const antennaTip = new THREE.Mesh(antennaTipGeo, antennaTipMat);
    antennaTip.position.set(0, 1.78, -0.1);
    robotGroup.add(antennaTip);

    // 6. Floating Quantum Gyro Rings (ChainGPT Orbital Rings)
    const ring1Geo = new THREE.TorusGeometry(1.9, 0.02, 16, 100);
    const ring1Mat = new THREE.MeshStandardMaterial({
      color: 0x2de7d3,
      emissive: 0x2de7d3,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.9,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    scene.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(2.2, 0.015, 16, 100);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xa855f7,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.9,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI / 4;
    scene.add(ring2);

    const ring3Geo = new THREE.TorusGeometry(2.5, 0.012, 16, 100);
    const ring3Mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
      roughness: 0.2,
      metalness: 0.9,
    });
    const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3.rotation.z = Math.PI / 6;
    scene.add(ring3);

    // 7. Ambient Floating Particle Swarm (Cybernetic Dust)
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (Math.random() - 0.5) * 14;
      particlePos[i + 1] = (Math.random() - 0.5) * 14;
      particlePos[i + 2] = (Math.random() - 0.5) * 10;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.045,
      color: 0x2de7d3,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- Cursor Tracking & Physics Lerp ---
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      mouse.targetX = (clientX / rect.width) * 2 - 1;
      mouse.targetY = -(clientY / rect.height) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Touch support for mobile/tablets
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = container.getBoundingClientRect();
        const clientX = e.touches[0].clientX - rect.left;
        const clientY = e.touches[0].clientY - rect.top;
        mouse.targetX = (clientX / rect.width) * 2 - 1;
        mouse.targetY = -(clientY / rect.height) * 2 + 1;
      }
    };
    window.addEventListener('touchmove', handleTouchMove);

    // --- Resize Handler ---
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // --- Animation Loop ---
    let clock = new THREE.Clock();
    let animationId: number;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse lerping
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      // Robot Head Tracking: Rotates with cursor position
      robotGroup.rotation.y = mouse.x * 0.75;
      robotGroup.rotation.x = -mouse.y * 0.5;

      // Floating gentle breathing bob
      robotGroup.position.y = Math.sin(elapsedTime * 1.6) * 0.12;
      robotGroup.position.x = Math.sin(elapsedTime * 0.8) * 0.05;

      // Dynamic Eye Tracking offset within visor
      eyeGroup.position.x = mouse.x * 0.12;
      eyeGroup.position.y = mouse.y * 0.08;

      // Eye pulsing blink
      const blinkScale = Math.sin(elapsedTime * 3.5) > 0.98 ? 0.1 : 1.0;
      eyeGroup.scale.y = blinkScale;

      // Rotating Quantum Gyro Rings
      ring1.rotation.x += 0.008;
      ring1.rotation.y += 0.006;
      ring1.position.y = robotGroup.position.y;

      ring2.rotation.y -= 0.007;
      ring2.rotation.z += 0.005;
      ring2.position.y = robotGroup.position.y;

      ring3.rotation.z += 0.004;
      ring3.rotation.x -= 0.006;
      ring3.position.y = robotGroup.position.y;

      // Particle subtle rotation
      particles.rotation.y = elapsedTime * 0.03;
      particles.rotation.x = elapsedTime * 0.015;

      // Point lights dynamic movement tracking cursor
      cyanPointLight.position.x = 3 + mouse.x * 2;
      cyanPointLight.position.y = 3 + mouse.y * 2;

      purplePointLight.position.x = -3 - mouse.x * 2;
      purplePointLight.position.y = -2 - mouse.y * 2;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={onInteract}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: 'grab',
      }}
    />
  );
};
