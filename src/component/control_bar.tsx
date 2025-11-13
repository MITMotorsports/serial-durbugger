export default function NavBar() {
    return <>
        <div className="titlebar">
            <div data-tauri-drag-region >
                <div className="controls">
                    <div className="example focus">
                        <div className="traffic-lights">
                            <button className="traffic-light traffic-light-close" id="close"></button>
                            <button className="traffic-light traffic-light-minimize" id="minimize"></button>
                            <button className="traffic-light traffic-light-maximize" id="maximize"></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </>
}