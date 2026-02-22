# NavSat - BrisHack Satellite Tracker
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![Threejs](https://img.shields.io/badge/threejs-black?style=for-the-badge&logo=three.js&logoColor=white)
![NPM](https://img.shields.io/badge/NPM-%23CB3837.svg?style=for-the-badge&logo=npm&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-%46E3B7.svg?style=for-the-badge&logo=render&logoColor=white)

## Contents
- [About NavSat](#about-navsat)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [How It Works](#how-it-works)
- [Project Origins](#project-origins)
- [Dev team roles](#dev-team-roles)
- [Fun Facts!](#fun-facts)
- [License](#license)

## About NavSat
Navsat is a platform that allows users to interact with orbital satellites in real time. 
Using [CelesTrak's](https://celestrak.org/) vast array of satellite telemetrics and [Three.js](https://threejs.org) 3D rendering, users
explore the orbits of thousands of active satellites across our planet, where each satellite is colour coded by the country of origin

## Features
- Real-time satellite position tracking with SGP4 propagation
- Interactive 3D globe using Three.js
- Plenty of satellite groups to select (Brightest, Stations, etc...)
- Detailed orbital statistics for all the nerds
- Colour coding by geographical location
- User location visualisation
- Satellite-focused camera orbiting system
- Gradient orbital trail for trajectory visualisation

## Tech Stack
- Frontend: Vite, Three.js, satellite.js, npm.js
- Backend: FastAPI, Supabase PostgreSQL
- Data Source: CelesTrak Orbital Database
- Deployment: Vercel, Render
      
## How It Works

NavSat fetches real-time TLE (Two-Line Element) data from CelesTrak, a highly prestigious source for satellite orbital information
& telemetry. The data collected is ran through multiple orbital calculations such as an SGP4 propagation algorithm via satellite.js,
using this we can calculate satellite positions to a tee in real-time.
	
        
The visualisation continuously updates as the satellites orbit Earth, accurate altitudes, velocities and orbital parameters can be
found whenever you click on a satellite.
        
## Project Origins
        
NavSat was developed for BrisHack 2026 by Ewan Friend, Michael Li, Kyrian Salas, Sam Bunting, Jacob Pankowski as an exploration of 
space technology. We have tried our best to make the interface as engaging as possible to our users, and  we hope you guys enjoy 
exploring the wonders of our orbital advancements as we have!
        
## Dev team roles
        
- Ewan Friend: Created this about page! also established the API connections between the CelestTrak telemetry data, the backend, and the frontend. Also added the user location pointer as well as scoping animation (some ui bits too)
- Michael Li: Developed the 3D graphics and rendering, performance engineering.
- Jacob Pankowski: Implemented satellite tracking and orbital calculations.
- Kyrian Salas: Backend API development and database management, DevOps. 
- Sam Bunting: Designed user interface (UI) and enhanced user experience (UX), incorporated Open API support.
        
## Fun Facts!
        
-After an aggresive launching campaign, Starlink satellites comprise approximately 65% of all active satellites in low Earth orbit
-In 1957, Sputnik 1 became the first ever satellite to be launched into Earths orbit
-After the successful launch of the first, Sputnik 2 became the second satellite to be launched into orbit, also becoming the first
to carry an animal into orbit, that being Laika: 'the space dog'

-In order to remain in low earth orbit, a satellite has to travel at 17450 miles per hour, a farther satellite will need to travel
slower, a geostationary satellite only travels at around 6568 miles per hour

-The first military satellite, GRAB 1, was launched by the US in 1960, it was designed to intercept Soviet radar signals from above
-When a satellite reaches the end of its lifespan, it is often moved to a 'graveyard orbit' to avoid collitions with satellites that
still operational; Other satellites are designed to burn up upon re-entry into Earths atmosphere to reduce space debris
   
Data sourced from [CelesTrak](https://celestrak.org/NORAD/documentation/gp-data-formats.php)
Orbit calculations via [satellite.js](https://github.com/shashwatak/satellite-js)

## License
MIT
