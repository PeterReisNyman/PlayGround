# source /Users/peternyman/Documents/myenv/bin/activate
import random as rnd
import math


# cords = [75,51]

# quad1 = [[0,50],[0,50]]
# quad2 = [[50,100],[0,50]]
# quad3 = [[0,50],[50,100]]
# quad4 = [[50,100],[50,100]]

# wheigts = [[(rnd.random()-0.5)*50, (rnd.random()-0.5)*50],
#            [(rnd.random()-0.5)*50, (rnd.random()-0.5)*50],
#            [(rnd.random()-0.5)*50, (rnd.random()-0.5)*50],
#            [(rnd.random()-0.5)*50, (rnd.random()-0.5)*50]]
# bais = [(rnd.random()-0.5)*50, (rnd.random()-0.5)*50, (rnd.random()-0.5)*50, (rnd.random()-0.5)*50]

# #print the weights and biases
# print("Weights:", wheigts)
# print("Biases:", bais)

# plane = [quad1, quad2, quad3, quad4]

# def what_quad(cords):
#     for quad in plane:
#         if cords[0] >= quad[0][0] and cords[0] <= quad[0][1] and cords[1] >= quad[1][0] and cords[1] <= quad[1][1]:
#             return plane.index(quad)

# def softmax(x):
#     e_x = np.exp(x - np.max(x))  # improve stability
#     return e_x / e_x.sum()

# def evaluate(cords):
#     raw_result = []
#     for i in range(len(wheigts)):
#         raw_result.append((cords[0] * wheigts[i][0] + cords[1] * wheigts[i][1]) + bais[i])
#     probs = softmax(raw_result)
#     return probs



# print("Cords:", cords)
# print("Plane:", what_quad(cords))  
# print("Evaluation:", evaluate(cords))



thirds = [0,20,40,60]
wheigts = [1,0,-4]
bais = [0,0,0]
alpha = 0.001


def what_thirds(num):
    result = []
    for third in thirds:
        if num >= third and num < third + 20:
            result.append(1)
        else:
            result.append(0)
    return result
        
def exp(x, terms=20):
    result = 1
    term = 1
    for i in range(1, terms):
        term *= x / i
        result += term
    return max(result, 0.0)

def softmax(input):
    max_input = max(input)  # for stability
    exps = [exp(i - max_input) for i in input]
    total = sum(exps)
    return [x / total for x in exps]

def evaluate(input):
    raw_result = []
    for i in range(len(wheigts)):
        raw_result.append(input * wheigts[i] + bais[i])
    probs = softmax(raw_result)
    return probs



for _ in range(100000):

    example = rnd.randint(0, 60)
    print("Example:", example)

    output = evaluate(example)
    truth = what_thirds(example)

    for i in range(len(output)):
        diff = output[i] - truth[i]
        print(f"Output for third {i+1}: {output[i]}, Truth: {truth[i]}")
        bais[i] = bais[i] - alpha * diff
        wheigts[i] = wheigts[i] - alpha * diff * example

    print("bais:", bais)
    print("wheigts:", wheigts)
        









