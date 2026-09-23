import {Component,type ReactNode,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import {CameraRig} from './CameraRig';
import {TeaHost} from './TeaHost';
import {STATIONS,type Point} from './stations';
import type {Station} from '../shared/contracts';
function Box({position,size,color}:{position:Point;size:Point;color:string}){return <mesh position={position} receiveShadow castShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.9}/></mesh>;}
function Cup({position,color='#697558'}:{position:Point;color?:string}){return <group position={position}><mesh><cylinderGeometry args={[.105,.075,.13,24]}/><meshStandardMaterial color={color} roughness={.7}/></mesh><mesh position={[0,.068,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.085,24]}/><meshStandardMaterial color="#59381f" roughness={.3}/></mesh></group>;}
function RoomGeometry(){return <>
  <color attach="background" args={['#352c26']}/>
  <ambientLight intensity={1.1} color="#dac6a1"/>
  <directionalLight position={[-2,5,2]} intensity={2} color="#ffdfa4" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5}/>
  <pointLight position={[2.6,2.7,-1.8]} intensity={15} distance={7} color="#ffc36d"/>
  <Box position={[0,-.12,.5]} size={[8,.2,8]} color="#654735"/>
  {Array.from({length:15},(_,i)=><Box key={i} position={[-3.75+i*.53,-.012,.5]} size={[.018,.006,8]} color="#3c2b22"/>)}
  <Box position={[0,1.8,-3]} size={[8,3.6,.15]} color="#574332"/>
  <Box position={[-4,1.8,.4]} size={[.15,3.6,7]} color="#6b5140"/>
  <Box position={[4,1.8,.4]} size={[.15,3.6,7]} color="#6b5140"/>
  {[-2.9,-.7].map(x=><group key={x}>
    <Box position={[x,1.95,-2.9]} size={[1.7,2.35,.06]} color="#d7bd89"/>
    {[-.82,0,.82].map(dx=><Box key={dx} position={[x+dx,1.95,-2.83]} size={[.055,2.4,.07]} color="#533d2b"/>)}
    {[.8,1.4,2,2.6,3.1].map(y=><Box key={y} position={[x,y,-2.82]} size={[1.7,.05,.07]} color="#533d2b"/>)}
  </group>)}
  {[-3.9,1,3.9].map(x=><Box key={x} position={[x,1.8,-2.72]} size={[.17,3.6,.2]} color="#38291f"/>)}
  <Box position={[0,3.3,-2.65]} size={[8,.2,.2]} color="#38291f"/>
  <Box position={[-2.3,.56,-1.3]} size={[2.45,1.12,.8]} color="#64412b"/>
  <Box position={[-2.3,1.16,-1.3]} size={[2.65,.12,1]} color="#96704a"/>
  {[-3.35,-2.8,-2.25,-1.7,-1.2].map(x=><Box key={x} position={[x,.57,-.875]} size={[.035,1,.025]} color="#b38a55"/>)}
  <Cup position={[-2.4,1.3,-1.15]}/><Cup position={[-2.7,1.3,-1.15]} color="#cfb88d"/>
  <Box position={[0,.02,-.1]} size={[2.6,.025,2.35]} color="#9d8c65"/>
  <Box position={[0,.54,-.2]} size={[1.65,.13,1.05]} color="#875c3b"/>
  {[-.67,.67].flatMap(x=>[-.58,.18].map(z=><Box key={`${x}${z}`} position={[x,.26,z]} size={[.12,.48,.12]} color="#543b2b"/>))}
  <Cup position={[-.38,.68,.03]}/><Cup position={[.4,.68,-.12]} color="#d8c19b"/>
  <mesh position={[0,.72,-.3]} scale={[1,.8,1]}><sphereGeometry args={[.19,24,16]}/><meshStandardMaterial color="#626a48" roughness={.7}/></mesh>
  <mesh position={[0,.9,-.3]}><sphereGeometry args={[.045,12,8]}/><meshStandardMaterial color="#626a48"/></mesh>
  <mesh position={[.17,.76,-.3]} rotation={[0,0,-.8]}><coneGeometry args={[.065,.22,16]}/><meshStandardMaterial color="#626a48"/></mesh>
  <Box position={[0,.13,1]} size={[.85,.22,.55]} color="#687153"/>
  <TeaHost/>
  { [.4,1.2,2,2.8].map(y=><Box key={y} position={[2.65,y,-2.65]} size={[1.85,.09,.45]} color="#8a6342"/>)}
  {[1.7,3.6].map(x=><Box key={x} position={[x,1.6,-2.65]} size={[.1,2.7,.45]} color="#483322"/>)}
  {[2,2.3,3.1].map((x,i)=><Cup key={x} position={[x,1.31,-2.55]} color={i===1?'#b87956':'#cabb9a'}/>)}
  <Box position={[2.65,2.26,-2.54]} size={[.43,.46,.04]} color="#f3e9d5"/>
  <Box position={[2.65,2.32,-2.51]} size={[.27,.015,.01]} color="#697558"/>
  <Box position={[2.65,2.22,-2.51]} size={[.27,.015,.01]} color="#b86c4f"/>
  {[-2.5,2.6].map(x=><group key={x} position={[x,2.7,-1.8]}>
    <mesh><cylinderGeometry args={[.24,.24,.52,8]}/><meshStandardMaterial color="#f0cf8d" emissive="#d99b44" emissiveIntensity={.4} roughness={1}/></mesh>
    {[-.28,.28].map(y=><mesh key={y} position={[0,y,0]}><cylinderGeometry args={[.26,.26,.045,8]}/><meshStandardMaterial color="#49382a"/></mesh>)}
    <Box position={[0,.5,0]} size={[.025,.5,.025]} color="#483322"/>
  </group>)}
</>;}
class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}>{
  state={failed:false}; static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}
export default function TeaRoom({station,onNavigate,reduced,resetKey,typing}:{station:Station;onNavigate:(s:Station)=>void;reduced:boolean;resetKey:number;typing:boolean}){
  const [lost,setLost]=useState(false);
  const fallback=<div className="scene-fallback"><span className="fallback-cup">♧</span><p>The room is resting.</p><small>The full ritual is available through the station controls.</small></div>;
  if(lost)return fallback;
  return <SceneBoundary fallback={fallback}><Canvas shadows dpr={[1,1.5]} camera={{position:[0,2.2,4.2],fov:50,near:.1,far:30}} fallback={fallback} onCreated={({gl})=>{gl.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();setLost(true);},{once:true});}}>
    <RoomGeometry/>
    <CameraRig station={station} reduced={reduced} resetKey={resetKey} typing={typing}/>
    {STATIONS.filter(s=>s.id!==station).map(s=><Html key={s.id} position={s.hotspot} center distanceFactor={7} zIndexRange={[10,0]}><button tabIndex={-1} aria-hidden="true" className="hotspot" onClick={()=>onNavigate(s.id)} disabled={typing}>{s.label}<span>↗</span></button></Html>)}
  </Canvas></SceneBoundary>;
}
