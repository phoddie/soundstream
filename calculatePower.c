#include "xsmc.h"
#include "mc.xs.h"
#include "xsHost.h"

void xs_calculatePower(xsMachine *the)
{
	int16_t *samples;
	xsUnsignedValue count, i;
	uint32_t power = 0;

	xsmcGetBufferReadable(xsArg(0), (void *)&samples, &count);
	count >>= 1;
	
	for (i = 0; i < count; i++) {
		int16_t sample = *samples++;
		power += sample * sample;
	}

	xsmcSetNumber(xsResult, c_sqrt((double)power / (double)count));
}
