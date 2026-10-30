import AppKit

let outDir = CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : FileManager.default.currentDirectoryPath

func render(_ draw: (CGContext) -> Void) -> NSBitmapImageRep {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: 1024,
        pixelsHigh: 1024,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    let ctx = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = ctx
    let cg = ctx.cgContext
    cg.setFillColor(NSColor.white.cgColor)
    cg.translateBy(x: 0, y: 1024)
    cg.scaleBy(x: 1, y: -1)
    draw(cg)
    NSGraphicsContext.restoreGraphicsState()
    return rep
}

func save(_ rep: NSBitmapImageRep, name: String) {
    let url = URL(fileURLWithPath: outDir).appendingPathComponent(name)
    try! rep.representation(using: .png, properties: [:])!.write(to: url)
    print("wrote \(url.path)")
}

save(render { cg in
    cg.addEllipse(in: CGRect(x: 176, y: 176, width: 672, height: 672))
    cg.addEllipse(in: CGRect(x: 198, y: 198, width: 628, height: 628))
    cg.drawPath(using: .eoFill)

    let ticks: [CGRect] = [
        CGRect(x: 502, y: 126, width: 20, height: 58),
        CGRect(x: 502, y: 840, width: 20, height: 58),
        CGRect(x: 126, y: 502, width: 58, height: 20),
        CGRect(x: 840, y: 502, width: 58, height: 20)
    ]
    for rect in ticks {
        let path = CGPath(roundedRect: rect, cornerWidth: 4, cornerHeight: 4, transform: nil)
        cg.addPath(path)
        cg.fillPath()
    }
}, name: "ring.png")

func hourglassBulb(from y0: CGFloat, to y1: CGFloat, flareAt start: CGFloat) -> CGMutablePath {
    let path = CGMutablePath()
    let cx = 512.0
    let halfW = 172.0
    let waist: CGFloat = 16
    let cap: CGFloat = 42
    let top = min(y0, y1)
    let bottom = max(y0, y1)
    let goingDown = y1 > y0

    if goingDown {
        path.move(to: CGPoint(x: cx - halfW + 28, y: top))
        path.addLine(to: CGPoint(x: cx + halfW - 28, y: top))
        path.addQuadCurve(to: CGPoint(x: cx + halfW, y: top + 28), control: CGPoint(x: cx + halfW, y: top))
        path.addLine(to: CGPoint(x: cx + halfW, y: top + cap))
        path.addQuadCurve(to: CGPoint(x: cx + waist, y: bottom), control: CGPoint(x: cx + halfW - 8, y: start))
        path.addQuadCurve(to: CGPoint(x: cx - waist, y: bottom), control: CGPoint(x: cx, y: bottom + 10))
        path.addQuadCurve(to: CGPoint(x: cx - halfW, y: top + cap), control: CGPoint(x: cx - halfW + 8, y: start))
        path.addLine(to: CGPoint(x: cx - halfW, y: top + 28))
        path.addQuadCurve(to: CGPoint(x: cx - halfW + 28, y: top), control: CGPoint(x: cx - halfW, y: top))
    } else {
        path.move(to: CGPoint(x: cx - halfW + 28, y: bottom))
        path.addLine(to: CGPoint(x: cx + halfW - 28, y: bottom))
        path.addQuadCurve(to: CGPoint(x: cx + halfW, y: bottom - 28), control: CGPoint(x: cx + halfW, y: bottom))
        path.addLine(to: CGPoint(x: cx + halfW, y: bottom - cap))
        path.addQuadCurve(to: CGPoint(x: cx + waist, y: top), control: CGPoint(x: cx + halfW - 8, y: start))
        path.addQuadCurve(to: CGPoint(x: cx - waist, y: top), control: CGPoint(x: cx, y: top - 10))
        path.addQuadCurve(to: CGPoint(x: cx - halfW, y: bottom - cap), control: CGPoint(x: cx - halfW + 8, y: start))
        path.addLine(to: CGPoint(x: cx - halfW, y: bottom - 28))
        path.addQuadCurve(to: CGPoint(x: cx - halfW + 28, y: bottom), control: CGPoint(x: cx - halfW, y: bottom))
    }
    path.closeSubpath()
    return path
}

save(render { cg in
    cg.addPath(hourglassBulb(from: 248, to: 536, flareAt: 390))
    cg.fillPath()
}, name: "hourglass-top.png")

save(render { cg in
    cg.addPath(hourglassBulb(from: 776, to: 488, flareAt: 634))
    cg.fillPath()
}, name: "hourglass-bottom.png")

save(render { cg in
    cg.addPath(hourglassBulb(from: 248, to: 536, flareAt: 390))
    cg.fillPath()
    cg.addPath(hourglassBulb(from: 776, to: 488, flareAt: 634))
    cg.fillPath()
}, name: "hourglass.png")

save(render { cg in
    let path = CGMutablePath()
    path.move(to: CGPoint(x: 500, y: 236))
    path.addCurve(to: CGPoint(x: 506, y: 420), control1: CGPoint(x: 494, y: 300), control2: CGPoint(x: 516, y: 360))
    path.addCurve(to: CGPoint(x: 512, y: 512), control1: CGPoint(x: 500, y: 460), control2: CGPoint(x: 522, y: 492))
    path.addCurve(to: CGPoint(x: 518, y: 604), control1: CGPoint(x: 502, y: 532), control2: CGPoint(x: 526, y: 564))
    path.addCurve(to: CGPoint(x: 524, y: 788), control1: CGPoint(x: 508, y: 664), control2: CGPoint(x: 530, y: 724))
    path.addLine(to: CGPoint(x: 544, y: 788))
    path.addCurve(to: CGPoint(x: 530, y: 604), control1: CGPoint(x: 538, y: 724), control2: CGPoint(x: 516, y: 664))
    path.addCurve(to: CGPoint(x: 524, y: 512), control1: CGPoint(x: 538, y: 564), control2: CGPoint(x: 514, y: 532))
    path.addCurve(to: CGPoint(x: 518, y: 420), control1: CGPoint(x: 534, y: 492), control2: CGPoint(x: 512, y: 460))
    path.addCurve(to: CGPoint(x: 524, y: 236), control1: CGPoint(x: 528, y: 360), control2: CGPoint(x: 506, y: 300))
    path.closeSubpath()
    cg.addPath(path)
    cg.fillPath()
    cg.fillEllipse(in: CGRect(x: 494, y: 494, width: 36, height: 36))
}, name: "rift.png")
