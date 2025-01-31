import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CoupleRepository {
    async findPendingCouplesByUser(userId: number) {
        const listCouple = await prisma.couple.findMany({
            where: {
                OR: [{ senderId: userId }, { reciverId: userId }],
                status: 0,
            },
            include: {
                sender: { select: { id: true, fullName: true, codeUser: true } },
                reciver: { select: { id: true, fullName: true, codeUser: true } },
            },
        });

        const filterRequestSent = listCouple.find(couple => couple.senderId === userId);
        const requestSent = filterRequestSent
            ? {
                id: filterRequestSent.id,
                status: filterRequestSent.status,
                reciver: {
                    id: filterRequestSent.reciver?.id,
                    fullName: filterRequestSent.reciver?.fullName,
                    codeUser: filterRequestSent.reciver?.codeUser,
                },
            }
            : null;

        const requestReceived = listCouple
            .filter(couple => couple.reciverId === userId)
            .map(couple => ({
                id: couple.id,
                status: couple.status,
                sender: {
                    id: couple.sender?.id,
                    fullName: couple.sender?.fullName,
                    codeUser: couple.sender?.codeUser,
                },
            }));

        return { requestSent, requestReceived };
    }
}
