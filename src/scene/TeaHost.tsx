export function TeaHost(){return <group position={[2,0,-0.8]}>
  <mesh position={[0,.17,0]} scale={[.8,.2,.65]}><sphereGeometry args={[1,24,12]}/><meshStandardMaterial color="#697558" roughness={1}/></mesh>
  <mesh position={[0,.65,0]}><coneGeometry args={[.47,1,24]}/><meshStandardMaterial color="#706346" roughness={1}/></mesh>
  <mesh position={[0,1.29,0]}><sphereGeometry args={[.25,24,16]}/><meshStandardMaterial color="#d8af86" roughness={.95}/></mesh>
  <mesh position={[0,1.39,-.06]} scale={[1,1,.9]}><sphereGeometry args={[.25,20,12]}/><meshStandardMaterial color="#ded4bd" roughness={1}/></mesh>
  <mesh position={[0,1.3,.105]} scale={[1,.9,.65]}><sphereGeometry args={[.215,20,12]}/><meshStandardMaterial color="#d8af86" roughness={1}/></mesh>
  <mesh position={[0,1.1,.18]} rotation={[.12,0,Math.PI]}><coneGeometry args={[.16,.29,20]}/><meshStandardMaterial color="#ded4bd" roughness={1}/></mesh>
  {[-1,1].map(side=><group key={side}>
    <mesh position={[side*.075,1.32,.24]} scale={[1,.3,.5]}><sphereGeometry args={[.023,12,8]}/><meshStandardMaterial color="#413728"/></mesh>
    <mesh position={[side*.29,.76,.16]} rotation={[0,0,side*.5]}><capsuleGeometry args={[.12,.36,6,12]}/><meshStandardMaterial color="#706346" roughness={1}/></mesh>
    <mesh position={[side*.22,.6,.3]}><sphereGeometry args={[.105,16,10]}/><meshStandardMaterial color="#d8af86" roughness={1}/></mesh>
  </group>)}
</group>;}
