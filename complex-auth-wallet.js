// ⚠️ WARNING: THIS IS A DELIBERATELY VULNERABLE APP FOR TESTING ⚠️
// Do not use in production. Includes Race Conditions, Mass Assignment, and JWT Flaws.

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

const prisma = new PrismaClient();
const JWT_SECRET = "super_secret_key_123"; // BUG: Hardcoded secret, but easy to find.

// Helper: Verify Token
const verifyToken = (req) => {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  try {
    // BUG: Does not verify token expiry or audience properly
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch (e) {
    return null;
  }
};

// 1. LOGIN (JWT Forgery)
export async function POST_login(req) {
  const { email, password } = await req.json();
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user || user.password !== password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // BUG: Weak JWT configuration. Algorithm not enforced. 
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET);
  return NextResponse.json({ token });
}

// 2. UPDATE PROFILE (Mass Assignment)
export async function PATCH_profile(req) {
  const decoded = verifyToken(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  
  // BUG: Mass Assignment. A user can send {"role": "admin"} in the body.
  // The code updates ALL fields provided in the body.
  const updatedUser = await prisma.user.update({
    where: { id: decoded.userId },
    data: body 
  });

  return NextResponse.json({ message: "Profile updated", user: updatedUser });
}

// 3. TRANSFER MONEY (Race Condition)
export async function POST_transfer(req) {
  const decoded = verifyToken(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { receiverId, amount } = await req.json();

  // BUG: Race Condition. We check the balance, then update it. 
  // If two requests hit this at the same millisecond, they both pass the check.
  const sender = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (sender.balance < amount) {
    return NextResponse.json({ error: "Insufficient funds" }, { status: 400 });
  }

  // Deduct from sender
  await prisma.user.update({
    where: { id: decoded.userId },
    data: { balance: sender.balance - amount }
  });

  // Add to receiver
  await prisma.user.update({
    where: { id: receiverId },
    data: { balance: { increment: amount } }
  });

  return NextResponse.json({ message: "Transfer successful" });
}

// 4. GET RECEIPT (Hidden IDOR)
export async function GET_receipt(req) {
  const decoded = verifyToken(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const receiptId = url.searchParams.get('id');

  // BUG: Weak Ownership Check.
  // It creates a hash of (userId + receiptId) and checks it against a provided signature.
  // But if the signature is missing, it falls back to just checking if the receipt exists!
  const signature = url.searchParams.get('sig');
  const expectedSig = createHash('sha256').update(decoded.userId + receiptId).digest('hex');

  if (signature && signature !== expectedSig) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // If no signature is provided, it fetches the receipt anyway!
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  return NextResponse.json(receipt);
}
