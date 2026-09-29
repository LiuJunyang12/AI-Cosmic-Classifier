import { TargetType, Wavelength } from './types';

export function drawAstronomicalTarget(
  ctx: CanvasRenderingContext2D,
  type: TargetType,
  size: number,
  wavelength: Wavelength,
  dustCovered: boolean = false,
  pulse: number = 0
) {
  const radius = size / 2;
  ctx.save();
  ctx.translate(radius, radius);

  // Spectrum color shifts
  let primaryColor = '#00F2FE';
  let secondaryColor = '#7928CA';

  if (wavelength === 'infrared') {
    primaryColor = '#FF5E36';
    secondaryColor = '#FFB800';
  } else if (wavelength === 'xray') {
    primaryColor = '#9D00FF';
    secondaryColor = '#00F2FE';
  }

  // Draw dust fog if dust covered and wavelength is optical
  if (dustCovered && wavelength === 'optical') {
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
    const dustGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, radius * 0.8);
    dustGrad.addColorStop(0, 'rgba(80, 50, 30, 0.95)');
    dustGrad.addColorStop(0.7, 'rgba(40, 25, 15, 0.85)');
    dustGrad.addColorStop(1, 'rgba(20, 10, 5, 0)');
    ctx.fillStyle = dustGrad;
    ctx.fill();

    // Subtle glow hint
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 180, 100, 0.15)';
    ctx.fill();
    ctx.restore();
    return;
  }

  // Render actual celestial target type
  switch (type) {
    case 'spiral_galaxy': {
      // Central Core
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.25);
      coreGrad.addColorStop(0, '#FFFFFF');
      coreGrad.addColorStop(1, primaryColor);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Spiral Arms
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = primaryColor;
      for (let arm = 0; arm < 2; arm++) {
        ctx.beginPath();
        const angleOffset = arm * Math.PI;
        for (let i = 0; i < 40; i++) {
          const angle = i * 0.15 + angleOffset + pulse * 0.05;
          const r = (i / 40) * (radius * 0.85);
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r * 0.5; // Tilted galaxy
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }

    case 'elliptical_galaxy': {
      // Smooth oval light gradient
      ctx.save();
      ctx.rotate(0.4);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.8, radius * 0.45, 0, 0, Math.PI * 2);
      const ellipGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.8);
      ellipGrad.addColorStop(0, '#FFF8E7');
      ellipGrad.addColorStop(0.4, secondaryColor);
      ellipGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = ellipGrad;
      ctx.fill();
      ctx.restore();
      break;
    }

    case 'supernova': {
      // Expanding stellar burst & spikes
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.3 + Math.sin(pulse) * 2, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const len = radius * (0.6 + (i % 2 === 0 ? 0.3 : 0.1));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
        ctx.stroke();
      }
      break;
    }

    case 'black_hole': {
      // Event Horizon & Accretion Disk
      ctx.save();
      ctx.rotate(-0.3);

      // Accretion disk glow
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.85, radius * 0.25, 0, 0, Math.PI * 2);
      const diskGrad = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 0.85);
      diskGrad.addColorStop(0, '#FFFFFF');
      diskGrad.addColorStop(0.5, primaryColor);
      diskGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = diskGrad;
      ctx.fill();

      // Black Hole Shadow Core
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
      break;
    }

    case 'noise_artifact': {
      // Cosmic ray streak & CCD glitch dots
      ctx.strokeStyle = '#FF0055';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.6, -radius * 0.4);
      ctx.lineTo(radius * 0.5, radius * 0.6);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < 5; i++) {
        const rx = Math.sin(i * 99 + pulse) * radius * 0.5;
        const ry = Math.cos(i * 33 + pulse) * radius * 0.5;
        ctx.fillRect(rx, ry, 2, 2);
      }
      break;
    }
  }

  ctx.restore();
}
