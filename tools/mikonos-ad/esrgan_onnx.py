#!/usr/bin/env python3
"""Build an ONNX model of Real-ESRGAN's SRVGGNetCompact (realesr-general-x4v3) straight from
the .pth weights, without PyTorch. Optionally blends with the -wdn (denoise) weights, like
Real-ESRGAN's `-dn` option: w = dn * x4v3 + (1 - dn) * wdn.

usage: esrgan_onnx.py realesr-general-x4v3.pth realesr-general-wdn-x4v3.pth DN out.onnx
"""
import pickle, sys, zipfile
import numpy as np
import onnx
from onnx import helper, numpy_helper, TensorProto

DT = {"FloatStorage": np.float32, "HalfStorage": np.float16}

def load_pth(path):
    zf = zipfile.ZipFile(path)
    root = zf.namelist()[0].split("/")[0]

    class StorageType:
        def __init__(self, name): self.name = name

    def rebuild(storage, offset, size, stride, *_):
        n = int(np.prod(size)) if size else 1
        arr = storage[offset:offset + n] if tuple(stride) == tuple(np.cumprod((list(size[1:]) + [1])[::-1])[::-1]) \
            else np.lib.stride_tricks.as_strided(storage[offset:], size, [s * storage.itemsize for s in stride])
        return np.array(arr).reshape(size)

    # strict "weights only" unpickler: never imports anything; only tensors and dicts are allowed
    import collections
    ALLOWED = {("torch._utils", "_rebuild_tensor_v2"): rebuild,
               ("torch._utils", "_rebuild_parameter"): lambda t, *a: t,
               ("collections", "OrderedDict"): collections.OrderedDict}

    class U(pickle.Unpickler):
        def find_class(self, mod, name):
            if (mod, name) in ALLOWED: return ALLOWED[(mod, name)]
            if mod == "torch" and name in DT: return StorageType(name)
            raise pickle.UnpicklingError(f"refusing to load {mod}.{name}")

        def persistent_load(self, pid):
            _, st, key, _, _ = pid
            name = st.name if isinstance(st, StorageType) else "FloatStorage"
            return np.frombuffer(zf.read(f"{root}/data/{key}"), DT[name])

    d = U(zf.open(f"{root}/data.pkl")).load()
    return d.get("params", d.get("params_ema", d))

def build(sd, path):
    idx = sorted({int(k.split(".")[1]) for k in sd})
    nodes, inits, x = [], [], "input"
    for i in idx:
        k = f"body.{i}"
        w = sd[f"{k}.weight"].astype(np.float32)
        if w.ndim == 4:                                   # conv 3x3
            b = sd[f"{k}.bias"].astype(np.float32)
            inits += [numpy_helper.from_array(w, f"{k}.w"), numpy_helper.from_array(b, f"{k}.b")]
            nodes.append(helper.make_node("Conv", [x, f"{k}.w", f"{k}.b"], [f"{k}.o"], pads=[1, 1, 1, 1]))
        else:                                             # PReLU, per-channel slope
            inits.append(numpy_helper.from_array(w.reshape(-1, 1, 1), f"{k}.w"))
            nodes.append(helper.make_node("PRelu", [x, f"{k}.w"], [f"{k}.o"]))
        x = f"{k}.o"
    nodes.append(helper.make_node("DepthToSpace", [x], ["ps"], blocksize=4, mode="CRD"))   # pixel_shuffle
    inits.append(numpy_helper.from_array(np.array([1, 1, 4, 4], np.float32), "sc"))
    nodes.append(helper.make_node("Resize", ["input", "", "sc"], ["base"], mode="nearest"))
    nodes.append(helper.make_node("Add", ["ps", "base"], ["output"]))
    g = helper.make_graph(nodes, "srvgg",
                          [helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, 3, "h", "w"])],
                          [helper.make_tensor_value_info("output", TensorProto.FLOAT, [1, 3, "H", "W"])], inits)
    m = helper.make_model(g, opset_imports=[helper.make_opsetid("", 17)], ir_version=8)
    onnx.checker.check_model(m)
    onnx.save(m, path)

if __name__ == "__main__":
    a, b, dn, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
    sa, sb = load_pth(a), load_pth(b)
    build({k: dn * sa[k] + (1 - dn) * sb[k] for k in sa}, out)
    print("wrote", out, len(sa), "tensors")
