//
// import {WidgetBehavior, SetBehavior, Tool} from "./tool.ts";
//
// import React, {useEffect, useRef, useState} from 'react';
// import {CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
// import {Project} from "../device.tsx";
// import Input from "../component/input.tsx";
//
// // Define the type for an incoming packet.
// // export interface Packet {
// //     timestamp: number;
// //     type: 'txt' | 'error' | 'other';
// //     message: string;
// // }
//
// // Define the type for a single data point on the chart.
// // export interface PacketDataPoint {
// //     time: number;
// //     txt: number;
// //     error: number;
// //     other: number;
// //     total: number;
// // }
//
// type TimeSpan = 1000 | 5000 | 10000 | 20000 | 30000 | 60000;
//
// // This is the main component for the application.
// const Widget: React.FC<{ project: Project, behavior: WidgetBehavior & { type: "readout-log" } }> = ({
//                                                                                                        project,
//                                                                                                        behavior
//                                                                                                    }) => {
//     // const [data, setData] = useState<PacketDataPoint[]>([]);
//     const [data, setData] = useState<number[]>([]);
//     const [packetCount, setPacketCount] = useState<number>(0);
//     const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
//     const [selectedPacketsInTimeSlot, setSelectedPacketsInTimeSlot] = useState<Packet[]>([]);
//     const [chartWidth, setChartWidth] = useState<number>(-1);
//
//     const [zoomLevel, setZoomLevel] = useState<number>(0);
//     const timeSpans: TimeSpan[] = [1000, 5000, 10000, 20000, 30000, 60000]; // 1s, 5s, 1min
//     const timeSpan = timeSpans[zoomLevel];
//
//     // Use a ref to store detailed packets to avoid re-rendering the component on every packet.
//     const detailedPacketsRef = useRef<Packet[]>([]);
//     const containerRef = useRef<HTMLDivElement>();
//
//     // A helper function to format timestamps for the chart tooltip.
//     const formatXAxis = (tickItem: number) => {
//         return new Date(tickItem).toLocaleTimeString();
//     };
//
//     // A helper function to generate a random packet.
//     const generatePacket = (): Packet => {
//         const types = ['txt', 'error', 'other'];
//         const randomType = types[Math.floor(Math.random() * types.length)] as 'txt' | 'error' | 'other';
//         const packetData: Packet = {
//             timestamp: Date.now(),
//             type: randomType,
//             message: `Packet of type ${randomType} received at ${new Date().toLocaleTimeString()}`,
//         };
//         return packetData;
//     };
//
//     // This useEffect simulates the Tauri channel stream.
//     useEffect(() => {
//         const onPacketReceived = (newPacket: Packet) => {
//             // Add the new packet to the ref's array.
//             detailedPacketsRef.current.push(newPacket);
//             setPacketCount(prevCount => prevCount + 1);
//         };
//
//         // Simulate the packet stream at a random rate of ~10 packets/second.
//         const interval = setInterval(() => {
//             const packetsToSend = Math.floor(Math.random() * 5) + 8; // Random number between 8 and 12
//             for (let i = 0; i < packetsToSend; i++) {
//                 setTimeout(() => onPacketReceived(generatePacket()), Math.random() * 100);
//             }
//         }, 1000);
//
//         return () => clearInterval(interval);
//     }, []);
//
//     // This useEffect processes the raw packet data into chart data at a controlled interval.
//     useEffect(() => {
//         const processDataForChart = () => {
//             const dataMap = new Map<number, PacketDataPoint>();
//
//             const tenMinutesAgo = Date.now() - 600000;
//
//             // Filter out old packets and process new ones.
//             const currentPackets = detailedPacketsRef.current.filter(p => p.timestamp > tenMinutesAgo);
//
//             currentPackets.forEach(packet => {
//                 const timeSlot = Math.floor(packet.timestamp / timeSpan) * timeSpan;
//                 if (!dataMap.has(timeSlot)) {
//                     dataMap.set(timeSlot, {time: timeSlot, txt: 0, error: 0, other: 0, total: 0});
//                 }
//                 const entry = dataMap.get(timeSlot)!;
//                 entry[packet.type] = (entry[packet.type] || 0) + 1;
//                 entry.total += 1;
//             });
//
//             // Convert the map to an array and sort by time.
//             const sortedData = Array.from(dataMap.values()).sort((a, b) => a.time - b.time);
//
//             // Update the state with the new, processed data. This will create the "scrolling" effect.
//             setData(sortedData);
//
//             // Calculate the width for the chart. A base width of 40px per data point.
//             const containerWidth = containerRef.current.getBoundingClientRect().width;
//             if (sortedData.length * 40 > containerWidth) {
//                 setChartWidth(sortedData.length * 40)
//             }
//             // setChartWidth(Math.max(containerWidth, sortedData.length * 40));
//
//             // Keep detailed packets ref from getting too large.
//             detailedPacketsRef.current = currentPackets;
//         };
//
//         // Process the data every 100 milliseconds for a smoother scroll effect.
//         const interval = setInterval(processDataForChart, 100);
//
//         return () => clearInterval(interval);
//
//     }, [timeSpan]); // Re-run this effect if the timeSpan changes.
//
//     // Handle click on a chart data point
//     const handleChartClick = (e: any) => {
//         if (!e || !e.activeLabel) {
//             return;
//         }
//         const clickedTime = e.activeLabel as number;
//         const packetsForTime = detailedPacketsRef.current.filter(p => Math.floor(p.timestamp / timeSpan) * timeSpan === clickedTime);
//         setSelectedPacketsInTimeSlot(packetsForTime);
//         setIsSidebarOpen(true);
//     };
//
//     // Handlers for zoom buttons.
//     const handleZoomIn = () => {
//         setZoomLevel(prevLevel => Math.max(0, prevLevel - 1));
//     };
//
//     const handleZoomOut = () => {
//         setZoomLevel(prevLevel => Math.min(timeSpans.length - 1, prevLevel + 1));
//     };
//
//     // The main component render.
//     return (
//         <div className="h-full w-full text-[#333333] font-sans relative flex" ref={containerRef}>
//             <div className={`p-3 transition-all duration-300 ${isSidebarOpen ? 'w-full md:w-3/4' : 'w-full'}`}>
//                 <div className="h-full flex flex-col">
//                     <div className="flex justify-between items-start mb-4">
//                         <div>
//                             <h1 className="text-xl md:text-2xl font-bold">Packet Timeline</h1>
//                             <p className="text-sm md:text-base text-[#555555]">Live from {"idk"}</p>
//                         </div>
//                         <div className="text-right">
//                             <p className="text-xs md:text-sm font-semibold">Total Packets</p>
//                             <p className="text-2xl md:text-3xl font-bold text-[#2196F3]">{packetCount}</p>
//                         </div>
//                     </div>
//
//                     <div className="flex flex-col flex-grow relative w-full h-full">
//                         {/* Zoom controls are now a sibling of the scrolling container */}
//                         <div className="absolute top-2 right-2 flex space-x-2 z-10 align-middle">
//                             <h1 className={"my-auto"}>{timeSpans[zoomLevel]}ms</h1>
//                             <button
//                                 onClick={handleZoomIn}
//                                 disabled={zoomLevel === 0}
//                                 className="p-2 rounded-full text-[#555555] bg-[#E0E0E0] hover:bg-[#D0D0D0] disabled:bg-[#F5F5F5] disabled:text-gray-400 transition-colors shadow-sm"
//                             >
//                                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
//                                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
//                                      strokeLinejoin="round">
//                                     <line x1="12" y1="5" x2="12" y2="19"></line>
//                                     <line x1="5" y1="12" x2="19" y2="12"></line>
//                                 </svg>
//                             </button>
//                             <button
//                                 onClick={handleZoomOut}
//                                 disabled={zoomLevel === timeSpans.length - 1}
//                                 className="p-2 rounded-full text-[#555555] bg-[#E0E0E0] hover:bg-[#D0D0D0] disabled:bg-[#F5F5F5] disabled:text-gray-400 transition-colors shadow-sm"
//                             >
//                                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
//                                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
//                                      strokeLinejoin="round">
//                                     <line x1="5" y1="12" x2="19" y2="12"></line>
//                                 </svg>
//                             </button>
//                         </div>
//                         {/*<div className="absolute flex-grow overflow-x-auto w-64 h-full">*/}
//                         {/*    <ResponsiveContainer width={128} height="100%">*/}
//                         {/*        <LineChart data={data}>*/}
//                         {/*            <YAxis/>*/}
//                         {/*            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" strokeWidth={0}/>*/}
//                         {/*            <Line type="monotone" dataKey="txt" name="Text" stroke="#008000" strokeWidth={0}*/}
//                         {/*                  isAnimationActive={false}/>*/}
//
//                         {/*        </LineChart>*/}
//                         {/*    </ResponsiveContainer>*/}
//                         {/*</div>*/}
//                         <div className="flex-grow overflow-x-auto w-full h-full">
//                             <ResponsiveContainer
//                                 width={chartWidth <= 16 ? undefined : chartWidth}
//                             >
//                                 <LineChart
//                                     data={data}
//                                     onClick={handleChartClick}
//                                 >
//                                     <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0"/>
//                                     <XAxis dataKey="time" tickFormatter={formatXAxis} stroke="#808080"/>
//                                     <YAxis allowDecimals={false} stroke="#808080"/>
//                                     <Tooltip/>
//                                     <Line type="monotone" dataKey="txt" name="Text" stroke="#008000" strokeWidth={2}
//                                           dot={false}
//                                           isAnimationActive={false}/>
//                                     <Line type="monotone" dataKey="error" name="Errors" stroke="#F44336" strokeWidth={2}
//                                           dot={false} isAnimationActive={false}/>
//                                     <Line type="monotone" dataKey="other" name="Other" stroke="#2196F3" strokeWidth={2}
//                                           dot={false} isAnimationActive={false}/>
//                                 </LineChart>
//                             </ResponsiveContainer>
//                         </div>
//                     </div>
//
//
//                 </div>
//             </div>
//
//             <div
//                 className={`relative top-0 right-0 h-full bg-white shadow-lg transition-transform duration-300 z-50 transform
//               ${isSidebarOpen ? 'translate-x-0 w-3/4 sm:w-1/2 md:w-1/4' : 'hidden w-0 translate-x-full'} p-4 md:p-6 overflow-y-auto`}
//             >
//                 <div className="flex justify-between items-center border-b border-[#E0E0E0] pb-4 mb-4">
//                     <h2 className="text-lg md:text-xl font-bold">Packet Details</h2>
//                     <button
//                         onClick={() => setIsSidebarOpen(false)}
//                         className="text-[#333333] hover:text-[#555555] focus:outline-none"
//                     >
//                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
//                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                             <line x1="18" y1="6" x2="6" y2="18"></line>
//                             <line x1="6" y1="6" x2="18" y2="18"></line>
//                         </svg>
//                     </button>
//                 </div>
//                 {selectedPacketsInTimeSlot.length > 0 ? (
//                     <div>
//                         {selectedPacketsInTimeSlot.map((packet, index) => (
//                             <div key={index} className="bg-[#F5F5F5] rounded-lg p-4 mb-4 border border-[#E0E0E0]">
//                                 <div className="font-mono text-xs md:text-sm mb-2">
//                                     <span
//                                         className="font-semibold text-gray-600">Time:</span> {new Date(packet.timestamp).toLocaleTimeString()}
//                                 </div>
//                                 <div className="font-mono text-xs md:text-sm mb-2">
//                                     <span className="font-semibold text-gray-600">Type:</span> <span
//                                     className={`font-bold ${
//                                         packet.type === 'txt' ? 'text-green-700' :
//                                             packet.type === 'error' ? 'text-red-500' :
//                                                 'text-blue-500'
//                                     }`}>{packet.type}</span>
//                                 </div>
//                                 <div className="font-mono text-xs md:text-sm">
//                                     <span className="font-semibold text-gray-600">Message:</span> {packet.message}
//                                 </div>
//                             </div>
//                         ))}
//                     </div>
//                 ) : (
//                     <p className="text-center text-gray-500 mt-8">No packets to display for this timestamp.</p>
//                 )}
//             </div>
//         </div>
//     )
// }
//
// const Configurator: React.FC<{ setBehavior: SetBehavior }> = ({setBehavior}) => {
//     return <div>
//         <h1>Component ID:</h1>
//         <Input onChange={(e) => setBehavior({
//             component: e.target.value,
//         })}/>
//     </div>
// }
//
// export const ReadoutLog: Tool = {
//     type: "readout-log",
//     displayName: "Readout Log",
//     widget: (s, behavior) => <Widget project={s} behavior={behavior as WidgetBehavior & { type: "readout-log" }}/>,
//     configurator: (s) => <Configurator setBehavior={s}/>
// }