"""Utility to visualise training progress for the demo models."""

import matplotlib.pyplot as plt
from ai import train_thirds, train_quadrants


def plot_history(history, title):
    """Plot loss and accuracy from a training history."""
    fig, ax1 = plt.subplots()
    ax1.plot(history['loss'], label='loss')
    ax1.set_xlabel('epoch')
    ax1.set_ylabel('cross entropy loss')
    ax1.legend(loc='upper left')

    ax2 = ax1.twinx()
    ax2.plot(history['accuracy'], color='tab:orange', label='accuracy')
    ax2.set_ylabel('accuracy')
    ax2.legend(loc='upper right')

    plt.title(title)
    plt.tight_layout()
    return fig


def main():
    h1 = train_thirds(epochs=200)
    fig1 = plot_history(h1, 'Thirds Training')
    fig1.savefig('thirds_training.png')
    print('Saved thirds_training.png')

    h2 = train_quadrants(epochs=200)
    fig2 = plot_history(h2, 'Quadrant Training')
    fig2.savefig('quadrant_training.png')
    print('Saved quadrant_training.png')


if __name__ == '__main__':
    main()
