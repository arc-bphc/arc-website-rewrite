"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { CollectionEntry } from "astro:content"
import profileMask from "../assets/profile-mask.png"
import DecryptedText from "./TextAnimations/DecryptedText/DecryptedText"
import "../styles/globals.css"
import type { GetImageResult } from "astro"


export interface Face {
  id: string
  location: { x: number; y: number }
  bounds: { x: number; y: number; width: number; height: number }
  metadata: CollectionEntry<'members'>
  image: GetImageResult
}

interface Props {
  faces: Face[]
  originalWidth: number
  originalHeight: number
  imageUrl: string
  className: string
}

export default function TeamHUD({ faces, originalWidth, originalHeight, imageUrl, className }: Props) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [hoveredFace, setHoveredFace] = useState<string | null>(null)
  const [scanningFace, setScanningFace] = useState<string | null>(null)

  // Dynamically update image dimensions
  useEffect(() => {
    const updateSize = () => {
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect()
        setImageSize({ width: rect.width, height: rect.height })
      }
    }

    updateSize()
    window.addEventListener("resize", updateSize)
		
    //setHoveredFace("2024/20240478")

    return () => window.removeEventListener("resize", updateSize)
  }, [])

  const scaleX = imageSize.width / originalWidth
  const scaleY = imageSize.height / originalHeight

  const scaledFaces = faces.map((face) => ({
    ...face,
    bounds: {
      x: face.bounds.x * scaleX,
      y: face.bounds.y * scaleY,
      width: face.bounds.width * scaleX,
      height: face.bounds.height * scaleY,
    },
    location: {
      x: face.location.x * scaleX,
      y: face.location.y * scaleY,
    },
  }))

  const handleFaceHover = (faceId: string) => {
    setHoveredFace(faceId)
    setScanningFace(faceId)
    setTimeout(() => setScanningFace(null), 2000)
  }

  return (
    <>
      <div className={`relative rounded-md w-full overflow-hidden ${className}`} style={{ aspectRatio: `${originalWidth}/${originalHeight}` }}>
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Detected faces"
          className="w-full h-full object-contain"
        />

        <AnimatePresence>
          {hoveredFace && (
            <motion.div
              className="absolute inset-0 bg-black/60 pointer-events-none z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            ></motion.div>
          )}
        </AnimatePresence>

        {/* Face bounding overlays */}
        {scaledFaces.map((face) => (
          <div key={face.id}>
            {/* Bounding Box */}
            <motion.div
              className="absolute border-none cursor-pointer"
              style={{
                left: `${face.bounds.x}px`,
                top: `${face.bounds.y}px`,
                width: `${face.bounds.width}px`,
                height: `${face.bounds.height}px`,
              }}
              onHoverStart={() => handleFaceHover(face.id)}
              onHoverEnd={() => setHoveredFace(null)}
							data-cursor-hover
            >

              {scanningFace === face.id && (
                <motion.div
                  className="absolute inset-0 border-2 border-red-500 bg-primary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                />
              )}
            </motion.div>

          </div>
        ))}

        {/* HUD Overlay */}
        <AnimatePresence>
          {hoveredFace && (
            <motion.div
              className="absolute inset-0 pointer-events-none z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {scaledFaces
                .filter((face) => face.id === hoveredFace)
                .map((face) => (
                  <HUDOverlay key={face.id} face={face} containerWidth={imageSize.width} containerHeight={imageSize.height} />
                ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

function HUDOverlay({ face, containerWidth, containerHeight }: { face: Face; containerWidth: number; containerHeight: number }) {
  const padding = 30
  const boxWidth = 320
  const boxHeight = 180

  // Decide positioning based on space
  const canPlaceRight = face.location.x + padding + boxWidth < containerWidth
  const canPlaceLeft = face.location.x - padding - boxWidth > 0
  const canPlaceAbove = face.location.y - padding - boxHeight > 0
  const canPlaceBelow = face.location.y + padding + boxHeight < containerHeight

  const boxX = canPlaceRight
    ? face.location.x + padding
    : canPlaceLeft
    ? face.location.x - padding - boxWidth
    : Math.max(containerWidth - boxWidth - 10, 0)

  const boxY = canPlaceBelow
    ? face.bounds.y - 20
    : canPlaceAbove
    ? face.location.y - padding - boxHeight
    : Math.max(containerHeight - boxHeight - 10, 0)
  return (
    <>
      {/* Connector Line and Dot */}
      <motion.svg className="absolute inset-0 pointer-events-none w-full h-full">
        <motion.line
          x1={face.location.x}
          y1={face.location.y}
          x2={boxX + boxWidth / 4}
          y2={boxY + boxHeight / 2}
          stroke="#ccff00"
          strokeWidth="2"
          strokeDasharray="5,5"
          className="drop-shadow-[0_0_8px_#ccff00] z-50"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: .5 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <motion.circle
          cx={face.location.x}
          cy={face.location.y}
          r="2"
          fill="#ccff00"
          className="drop-shadow-[0_0_6px_#ccff00] z-50"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 }}
        />
      </motion.svg>

      {/* Floating HUD Box */}
      <motion.div
        className="absolute flex flex-row justify-center items-center"
        style={{ left: `${boxX}px`, top: `${boxY}px`, width: `${boxWidth}px`, height: `${boxHeight}px`}}
        initial={{ opacity: 0, scale: 0.8}}
        animate={{ opacity: 1, scale: 1}}
        exit={{ opacity: 0, scale: 0.8}}
        transition={{
          type: "spring",
          damping: 20,
          stiffness: 300,
          y: {
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
            ease: "easeInOut",
          },
        }}
      >
        {/* HUD Styling */}
        <div className="w-24 inset-0 relative mr-2">
				  <img src={face.image.src} srcSet={face.image.src} alt="headshot" className="w-20 aspect-[3/4] z-10 object-cover"
            style={{
              maskSize: "cover",
              maskImage: `url(${profileMask.src})`,
              maskRepeat: "no-repeat"
            }}
          />
          <div className="absolute w-20 aspect-[3/4] inset-0 bg-[var(--primary)]/15"
            style={{
              maskSize: "cover",
              maskImage: `url(${profileMask.src})`,
              maskRepeat: "no-repeat"
            }}
          ></div>
            <div
              className="absolute inset-0 pointer-events-none animate-pulse w-20 aspect-[3/4]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, rgba(0,0,0,0.3) 0px, rgba(0,0,0,0.3) 1px, transparent 1px, transparent 3px)",
                maskSize: "cover",
                maskImage: `url(${profileMask.src})`,
                maskRepeat: "no-repeat"
              }}
            />
        </div>
        <div className="relative w-48 h-26">
          <svg viewBox="94 64 14 8" className="absolute left-[-1rem] top-[-.5rem] h-1/3">
            <g>
              <path
                d="m 96.95444,65.056409 h -1.321043 c -0.880695,0.176388 -0.440347,0.264582 1.321043,0.264582 h 7.05793 l 2.40211,-0.453286 H 94.867711 v 6.515501 l 0.45763,-2.370558 v -3.061689 c 0,-0.857541 -0.08819,-0.991532 -0.264582,-0.401972 v 0.401972 3.049037 l 0.0024,-0.02508 -0.193048,1.000001 0.262184,0.02508 v -5.000001 l -0.132291,0.132291 H 105 l -0.0245,-0.262288 -1,0.188704 0.0245,-0.0023 z"
                style={{
                  fill: "#FFFFFF",
                  fillRule: "nonzero",
                  stroke: "none",
                  strokeWidth: 0.264583,
                }}
              />

              <path
                d="m 97.011319,64.999996 -2.011317,2.000001 v -2.000001 z"
                style={{
                  fill: "#FFFFFF",
                  strokeWidth: 0.264583,
                }}
              />
            </g>
          </svg>
          <svg viewBox="94 81 30 15" xmlns="http://www.w3.org/2000/svg" className="absolute bottom-[-.5rem] left-[-1rem] h-1/2">
            <g id="layer1">
              <path
                d="m 95.1,90.899803 2.000001,1 v 3 H 95.1 Z"
                style={{
                  fill: "#FFFFFF",
                  fillOpacity: 1,
                  stroke: "#FFFFFF",
                  strokeWidth: 0.2,
                  strokeDasharray: "none",
                  strokeOpacity: 1,
                }}
              />
              <path
                d="m 95.230002,85.999996 c 0,0 -0.153333,-0.333333 -0.46,-1 v 1 9.230001 H 122 h 3 c -2,-0.306667 -3,-0.46 -3,-0.46 H 95.000002 l 0.23,0.23 z"
                style={{
                  fill: "#FFFFFF",
                  fillOpacity: 1,
                  fillRule: "nonzero",
                  stroke: "none",
                  strokeWidth: 0.264583,
                  strokeLinecap: "butt",
                  strokeLinejoin: "round",
                  strokeMiterlimit: 0,
                  strokeDasharray: "none",
                  strokeOpacity: 1,
                  paintOrder: "normal",
                }}
              />
            </g>
          </svg>
          <div className="text-sm font-[Orbitron] text-white trackind-wide inset-2 ml-3 absolute left-[-1rem] top-[.25rem]"
            style={{
              letterSpacing: 1
            }}>
            <DecryptedText text={"Personal Info"}
              animateOn="view"
              revealDirection="start"
              sequential = {true}
            />
            <div className="text-[.75rem] font-extralight font-[Geist_Mono]"
              style={{
                letterSpacing: -.8
              }}>
              <DecryptedText text={"Name: " + face.metadata.data.name}
                animateOn="view"
                revealDirection="start"
                sequential = {true}
              />
              <br/>              
              <DecryptedText text={"ID: " + face.metadata.data.id}
                animateOn="view"
                revealDirection="start"
                sequential = {true}
              />
              <br/>
              <DecryptedText text={"Branch: " + face.metadata.data.branch}
                animateOn="view"
                revealDirection="start"
                sequential = {true}
                speed={10}
              />
              <br/>
              <DecryptedText text={"Github: " + face.metadata.data.socials.github}
                animateOn="view"
                revealDirection="start"
                sequential = {true}
                speed={10}
              />
            </div>
          </div>

        </div>
      </motion.div>
    </>
  )
}
