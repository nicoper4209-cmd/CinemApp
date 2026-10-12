import { Component, input, output } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-movie-card',
  styleUrl: './movie-card.css',
  templateUrl: './movie-card.html',
})
export class MovieCard {
  id = input.required<number>();
  title = input('')
  poster = input('')
  alt= input('')
  year = input('')

  selected = output<number>()

  onSelect(){
    this.selected.emit(this.id())
  }
}
