import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that require authentication
const protectedRoutes = ["/admin", "/driver", "/hospital", "/profile"];

// Routes that are always public (no auth required)
const publicRoutes = ["/login", "/register", "/api/auth", "/api/seed"];

// Routes accessible by all authenticated users regardless of role
const universalAuthRoutes = ["/profile"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    publicRoutes.some((route) => pathname.startsWith(route)) ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Get session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Redirect to login if not authenticated
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = token.role as string;

  // Allow all authenticated users to access universal routes (e.g., /profile)
  if (universalAuthRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Role-based access checks
  switch (userRole) {
    case "admin":
      // Admin can access everything
      break;

    case "driver":
      // Block unapproved drivers — redirect to a pending page
      if (!token.isApproved) {
        const pendingUrl = new URL("/login", request.url);
        pendingUrl.searchParams.set("error", "pending_approval");
        return NextResponse.redirect(pendingUrl);
      }
      if (!pathname.startsWith("/driver")) {
        // If driver has no vehicleNumber, redirect to profile to complete setup
        if (!token.vehicleNumber) {
          return NextResponse.redirect(new URL("/profile", request.url));
        }
        const driverPath = `/driver/${token.vehicleNumber}`;
        return NextResponse.redirect(new URL(driverPath, request.url));
      }
      // Verify driver is accessing their own HUD
      {
        const pathVehicleId = pathname.split("/driver/")[1]?.split("/")[0];
        if (pathVehicleId && pathVehicleId !== token.vehicleNumber) {
          return NextResponse.redirect(
            new URL(`/driver/${token.vehicleNumber}`, request.url)
          );
        }
      }
      break;

    case "hospital":
      // Block unapproved hospital staff — redirect to a pending page
      if (!token.isApproved) {
        const pendingUrl = new URL("/login", request.url);
        pendingUrl.searchParams.set("error", "pending_approval");
        return NextResponse.redirect(pendingUrl);
      }
      if (!pathname.startsWith("/hospital")) {
        // If hospital staff has no hospitalId, redirect to profile to complete setup
        if (!token.hospitalId) {
          return NextResponse.redirect(new URL("/profile", request.url));
        }
        const hospitalPath = `/hospital/${token.hospitalId}`;
        return NextResponse.redirect(new URL(hospitalPath, request.url));
      }
      // Verify hospital staff is accessing their own ER
      {
        const pathHospitalId = pathname.split("/hospital/")[1]?.split("/")[0];
        if (pathHospitalId && pathHospitalId !== token.hospitalId) {
          return NextResponse.redirect(
            new URL(`/hospital/${token.hospitalId}`, request.url)
          );
        }
      }
      break;

    case "patient":
    default:
      // Patients should not access /admin, /driver, /hospital
      return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
