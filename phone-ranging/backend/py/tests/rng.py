"""mulberry32, matching backend/simulate.js so seeded layouts agree with the JS tests."""


def _u32(x):
    return x & 0xFFFFFFFF


class Rng:
    def __init__(self, seed=1):
        self.a = _u32(seed)

    def uniform(self):
        self.a = _u32(self.a + 0x6D2B79F5)
        t = self.a
        t = _u32(_u32(t ^ (t >> 15)) * _u32(t | 1))
        t = _u32(t ^ _u32(t + _u32(_u32(t ^ (t >> 7)) * _u32(t | 61))))
        return _u32(t ^ (t >> 14)) / 4294967296

    def gaussian(self):
        import math

        u = max(self.uniform(), 1e-12)
        v = self.uniform()
        return math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * v)
